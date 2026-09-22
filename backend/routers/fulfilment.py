"""Order operations (Section H): shipments, dispatch, delivery milestones, returns.

Separate state machines: payment | fulfilment | delivery | return. A fulfilment move never
rewrites payment history, and an unpaid order can never dispatch.
Courier data is explicitly manual unless a provider is integrated — nothing claims live tracking.
"""

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import FULFILMENT, OWNER, audit, has_role, now_utc, require_role
from lib.services import clean_doc
from models.users import utcnow

router = APIRouter()

# Eligible forward fulfilment path for a verified paid order.
FLOW = ["paid_ready", "processing", "packed", "ready_for_dispatch", "dispatched", "in_transit", "out_for_delivery", "delivered"]
BRANCHES = {"delivery_failed", "cancelled", "returned"}


class ShipmentItemIn(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=100)


class ShipmentIn(BaseModel):
    items: List[ShipmentItemIn] = Field(min_length=1)
    carrier: Optional[str] = Field(default=None, max_length=80)
    tracking_reference: Optional[str] = Field(default=None, max_length=120)
    tracking_url: Optional[str] = Field(default=None, max_length=400)
    pickup_at: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=500)


class Shipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_number: str
    order_id: str
    items: List[dict]
    carrier: Optional[str] = None
    tracking_reference: Optional[str] = None
    tracking_url: Optional[str] = None
    # Always true until a courier API is integrated — the UI must label updates as manual.
    tracking_is_manual: bool = True
    status: Literal["created", "dispatched", "in_transit", "out_for_delivery", "delivered", "delivery_failed", "returned"] = "created"
    pickup_at: Optional[datetime] = None
    milestones: List[dict] = Field(default_factory=list)
    created_by: str
    created_at: datetime = Field(default_factory=utcnow)


class ShipmentStatusIn(BaseModel):
    status: Literal["dispatched", "in_transit", "out_for_delivery", "delivered", "delivery_failed", "returned"]
    note: Optional[str] = Field(default=None, max_length=500)
    occurred_at: Optional[datetime] = None


class ReturnRequestIn(BaseModel):
    order_id: str
    reason: str = Field(min_length=3, max_length=500)
    kind: Literal["return", "trial", "warranty", "cancellation"] = "return"
    items: List[ShipmentItemIn] = Field(default_factory=list)


def _validate_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Tracking URL must start with http:// or https://")
    return url


async def _next_number(counter: str, prefix: str) -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": counter}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"{prefix}{doc['seq']:05d}"


# ---------------------------------------------------------------- dispatch queue

@router.get("/ops/dispatch-queue")
async def dispatch_queue(user=Depends(require_role(*FULFILMENT))):
    """Paid orders awaiting movement, plus explicit exception buckets."""
    paid = await db.orders.find(
        {"payment_status": "paid", "fulfilment_status": {"$nin": ["delivered", "cancelled", "returned"]}}
    ).sort("created_at", 1).to_list(200)
    rows = []
    for o in paid:
        shipped = await db.shipments.find({"order_id": o["id"]}).to_list(50)
        shipped_qty: dict = {}
        for s in shipped:
            for it in s["items"]:
                shipped_qty[it["variant_id"]] = shipped_qty.get(it["variant_id"], 0) + it["qty"]
        pending = [
            {"variant_id": i["variant_id"], "product_name": i["product_name"], "sku": i["sku"],
             "ordered": i["qty"], "shipped": shipped_qty.get(i["variant_id"], 0),
             "pending": i["qty"] - shipped_qty.get(i["variant_id"], 0)}
            for i in o["items"]
        ]
        rows.append({
            "order_id": o["id"], "order_number": o["order_number"], "customer": o.get("email"),
            "fulfilment_status": o["fulfilment_status"], "placed_at": o["created_at"],
            "total": o["amounts"]["total"], "items": pending,
            "fully_shipped": all(p["pending"] == 0 for p in pending),
            "shipments": len(shipped),
        })
    exceptions = await db.orders.count_documents({"fulfilment_status": "stock_exception"})
    return {"total": len(rows), "stock_exceptions": exceptions, "rows": rows}


# ---------------------------------------------------------------- shipments

@router.get("/ops/orders/{oid}/shipments", response_model=List[Shipment])
async def list_shipments(oid: str, user=Depends(require_role(*FULFILMENT))):
    docs = await db.shipments.find({"order_id": oid}).sort("created_at", 1).to_list(50)
    return [Shipment(**clean_doc(d)) for d in docs]


@router.post("/ops/orders/{oid}/shipments", response_model=Shipment, status_code=201)
async def create_shipment(oid: str, input: ShipmentIn, user=Depends(require_role(*FULFILMENT))):
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # An unpaid order can never dispatch.
    if order["payment_status"] != "paid":
        raise HTTPException(status_code=409, detail="Only a verified paid order can be dispatched")
    if order["fulfilment_status"] in ("cancelled", "returned"):
        raise HTTPException(status_code=409, detail="This order is closed for dispatch")

    ordered = {i["variant_id"]: i for i in order["items"]}
    prior = await db.shipments.find({"order_id": oid}).to_list(50)
    already: dict = {}
    for s in prior:
        for it in s["items"]:
            already[it["variant_id"]] = already.get(it["variant_id"], 0) + it["qty"]

    items: list = []
    for line in input.items:
        src = ordered.get(line.variant_id)
        if not src:
            raise HTTPException(status_code=422, detail="That item is not part of this order")
        remaining = src["qty"] - already.get(line.variant_id, 0)
        if line.qty > remaining:
            # Never ship more than purchased.
            raise HTTPException(
                status_code=409,
                detail=f"{src['product_name']}: only {remaining} unit(s) left to ship",
            )
        items.append({"variant_id": line.variant_id, "sku": src["sku"],
                      "product_name": src["product_name"], "qty": line.qty})

    shipment = Shipment(
        shipment_number=await _next_number("shipment_number", "SH"),
        order_id=oid, items=items, carrier=input.carrier,
        tracking_reference=input.tracking_reference,
        tracking_url=_validate_url(input.tracking_url),
        pickup_at=input.pickup_at, created_by=user["id"],
        milestones=[{"at": now_utc(), "status": "created", "actor": user["email"], "note": input.note}],
    )
    await db.shipments.insert_one(shipment.model_dump())

    # Fulfilment state reflects partial vs full dispatch; payment history is untouched.
    total_shipped = {k: v for k, v in already.items()}
    for it in items:
        total_shipped[it["variant_id"]] = total_shipped.get(it["variant_id"], 0) + it["qty"]
    fully = all(total_shipped.get(i["variant_id"], 0) >= i["qty"] for i in order["items"])
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"fulfilment_status": "dispatched" if fully else "processing"},
         "$push": {"events": {"type": "shipment_created", "at": now_utc(),
                              "detail": f"{shipment.shipment_number} ({'full' if fully else 'partial'})"}}},
    )
    await audit(user, "ops.shipment.create", "order", oid, f"{shipment.shipment_number} {len(items)} line(s)")
    return shipment


@router.patch("/ops/shipments/{sid}/status", response_model=Shipment)
async def update_shipment_status(sid: str, input: ShipmentStatusIn, user=Depends(require_role(*FULFILMENT))):
    """Manual courier milestone. Never claimed as live carrier data."""
    s = await db.shipments.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if s["status"] == input.status:
        raise HTTPException(status_code=409, detail="The shipment is already in this state")
    if s["status"] == "delivered" and input.status != "returned":
        raise HTTPException(status_code=409, detail="A delivered shipment can only move to returned")

    await db.shipments.update_one(
        {"id": sid},
        {"$set": {"status": input.status},
         "$push": {"milestones": {"at": input.occurred_at or now_utc(), "status": input.status,
                                  "actor": user["email"], "note": input.note, "source": "manual"}}},
    )
    # Roll the order's fulfilment state up from its shipments.
    order_shipments = await db.shipments.find({"order_id": s["order_id"]}).to_list(50)
    statuses = {x["status"] if x["id"] != sid else input.status for x in order_shipments}
    order = await db.orders.find_one({"id": s["order_id"]})
    roll = None
    if statuses == {"delivered"}:
        ordered_total = sum(i["qty"] for i in order["items"])
        shipped_total = sum(it["qty"] for x in order_shipments for it in x["items"])
        roll = "delivered" if shipped_total >= ordered_total else "in_transit"
    elif "out_for_delivery" in statuses:
        roll = "out_for_delivery"
    elif "in_transit" in statuses:
        roll = "in_transit"
    elif "delivery_failed" in statuses:
        roll = "delivery_failed"
    if roll and order["fulfilment_status"] != roll:
        await db.orders.update_one(
            {"id": s["order_id"]},
            {"$set": {"fulfilment_status": roll},
             "$push": {"events": {"type": "fulfilment", "at": now_utc(), "detail": f"-> {roll} (manual courier update)"}}},
        )
    await audit(user, "ops.shipment.status", "shipment", sid, f"-> {input.status}")
    return Shipment(**clean_doc(await db.shipments.find_one({"id": sid})))


# ---------------------------------------------------------------- returns / trial / warranty

@router.get("/ops/returns")
async def list_returns(user=Depends(require_role(*FULFILMENT))):
    docs = await db.return_requests.find({}).sort("created_at", -1).to_list(200)
    return {"total": len(docs), "rows": [clean_doc(d) for d in docs]}


@router.post("/ops/returns", status_code=201)
async def create_return(input: ReturnRequestIn, user=Depends(require_role(OWNER, "admin", "manager", "crm_master", "crm_manager", "crm_employee"))):
    """CRM may RAISE a traceable request; only Owner/Admin may approve it and restock."""
    order = await db.orders.find_one({"id": input.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_status"] != "paid":
        raise HTTPException(status_code=409, detail="Only a paid order can have a return request")
    settings = await db.settings.find_one({"id": "site"}) or {}
    doc = {
        "id": str(uuid.uuid4()),
        "request_number": await _next_number("return_number", "RR"),
        "order_id": order["id"], "order_number": order["order_number"],
        "kind": input.kind, "reason": input.reason,
        "items": [i.model_dump() for i in input.items],
        "status": "requested",  # requested -> approved -> received -> inspected -> restocked/refunded | rejected
        "policy_version": (settings.get("policies") or {}).get("version", "pending_owner_approval"),
        "raised_by": user["email"], "raised_by_role": (user.get("roles") or [None])[0],
        "restocked": False, "trail": [{"at": now_utc(), "actor": user["email"], "status": "requested"}],
        "created_at": now_utc(),
    }
    await db.return_requests.insert_one(doc)
    await audit(user, "ops.return.create", "order", order["id"], f"{doc['request_number']} {input.kind}")
    return clean_doc(doc)


class ReturnPatch(BaseModel):
    status: Literal["approved", "received", "inspected", "restocked", "refund_requested", "rejected"]
    note: Optional[str] = Field(default=None, max_length=500)
    restock: bool = False


@router.patch("/ops/returns/{rid}")
async def patch_return(rid: str, input: ReturnPatch, user=Depends(require_role(OWNER, "admin"))):
    """Owner/Admin only. Restock happens on an inspected+approved return, never automatically."""
    doc = await db.return_requests.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found")
    if doc["status"] == input.status:
        raise HTTPException(status_code=409, detail="Already in this state")

    restocked = doc.get("restocked", False)
    if input.restock:
        if input.status != "restocked":
            raise HTTPException(status_code=422, detail="Restock is only valid with the 'restocked' status")
        if restocked:
            raise HTTPException(status_code=409, detail="This return has already been restocked")
        for it in doc.get("items", []):
            await db.variants.update_one({"id": it["variant_id"]}, {"$inc": {"stock": int(it["qty"])}})
            await db.inventory_ledger.insert_one({
                "id": str(uuid.uuid4()), "variant_id": it["variant_id"], "delta": int(it["qty"]),
                "reason": f"return {doc['request_number']} inspected & restocked",
                "actor_id": user["id"], "created_at": now_utc(),
            })
        restocked = True

    await db.return_requests.update_one(
        {"id": rid},
        {"$set": {"status": input.status, "restocked": restocked},
         "$push": {"trail": {"at": now_utc(), "actor": user["email"], "status": input.status, "note": input.note}}},
    )
    await audit(user, "ops.return.update", "return", rid, f"-> {input.status}{' +restock' if input.restock else ''}")
    return clean_doc(await db.return_requests.find_one({"id": rid}))


# ---------------------------------------------------------------- customer-facing tracking

@router.get("/ops/track/{order_number}")
async def public_track(order_number: str, email: str):
    """Customer tracking reads canonical milestones only; manual updates are labelled as such."""
    order = await db.orders.find_one({"order_number": order_number.strip().upper(), "email": email.strip().lower()})
    if not order:
        raise HTTPException(status_code=404, detail="No order matches that number and email")
    shipments = await db.shipments.find({"order_id": order["id"]}).sort("created_at", 1).to_list(50)
    return {
        "order_number": order["order_number"],
        "payment_status": order["payment_status"],
        "fulfilment_status": order["fulfilment_status"],
        "placed_at": order["created_at"],
        "items": [{"product_name": i["product_name"], "qty": i["qty"]} for i in order["items"]],
        "shipments": [{
            "shipment_number": s["shipment_number"],
            "status": s["status"],
            "carrier": s.get("carrier"),
            "tracking_reference": s.get("tracking_reference"),
            "tracking_url": s.get("tracking_url"),
            "tracking_is_manual": s.get("tracking_is_manual", True),
            "items": [{"product_name": i["product_name"], "qty": i["qty"]} for i in s["items"]],
            "milestones": [{"status": m["status"], "at": m["at"], "note": m.get("note")} for m in s.get("milestones", [])],
        } for s in shipments],
        "tracking_note": "Shipment updates are entered manually by Kotson staff — no courier API is connected yet.",
    }
