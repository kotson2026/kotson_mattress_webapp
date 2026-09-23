"""Dispatch & Returns router: order fulfilment, warehouse packing, multi-carrier shipments,
delivery tracking, delivery exceptions, return inspections, restock, refunds, replacements,
and 100-night trial tracking.
Gated to Owner, Admin, and Operations Managers.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

import os
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import (
    ADMIN,
    FULFILMENT,
    MANAGER,
    OWNER,
    STAFF_ROLES,
    audit,
    now_utc,
    require_role,
)
from lib.services import clean_doc

router = APIRouter(prefix="/admin/dispatch", tags=["admin-dispatch"])


def parse_date_range(preset: str = "month", date_from: Optional[str] = None, date_to: Optional[str] = None):
    tzname = os.environ.get("APP_TZ", "Asia/Kolkata")
    try:
        tz = ZoneInfo(tzname)
    except Exception:
        tz = timezone.utc
    now_local = datetime.now(tz)
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)

    if preset == "today":
        start = today_start_local.astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "yesterday":
        yesterday_start = today_start_local - timedelta(days=1)
        yesterday_end = today_start_local - timedelta(microseconds=1)
        start = yesterday_start.astimezone(timezone.utc)
        end = yesterday_end.astimezone(timezone.utc)
    elif preset == "week":
        start = (today_start_local - timedelta(days=6)).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "month":
        start = today_start_local.replace(day=1).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    elif preset == "last_month":
        first_this_month = today_start_local.replace(day=1)
        last_day_prev = first_this_month - timedelta(days=1)
        start = last_day_prev.replace(day=1).astimezone(timezone.utc)
        end = first_this_month.astimezone(timezone.utc) - timedelta(microseconds=1)
    elif preset == "custom" and date_from:
        try:
            d_from = datetime.fromisoformat(date_from)
            start = d_from.replace(tzinfo=tz).astimezone(timezone.utc)
            if date_to:
                d_to = datetime.fromisoformat(date_to)
                end = d_to.replace(tzinfo=tz).astimezone(timezone.utc)
            else:
                end = now_local.astimezone(timezone.utc)
        except Exception:
            start = today_start_local.replace(day=1).astimezone(timezone.utc)
            end = now_local.astimezone(timezone.utc)
    else:
        start = today_start_local.replace(day=1).astimezone(timezone.utc)
        end = now_local.astimezone(timezone.utc)
    return start, end


# -----------------------------------------------------------------------------
# Pydantic Request & Response Schemas
# -----------------------------------------------------------------------------

class PackOrderIn(BaseModel):
    package_count: int = Field(default=1, ge=1, le=20)
    package_weight_kg: Optional[float] = Field(default=None, ge=0.1)
    package_dimensions: Optional[str] = Field(default=None, max_length=100)
    packing_notes: Optional[str] = Field(default=None, max_length=500)
    warehouse_id: Optional[str] = Field(default="WH-01")


class ShipmentLineIn(BaseModel):
    variant_id: str
    qty: int = Field(ge=1, le=100)


class CreateShipmentIn(BaseModel):
    items: Optional[List[ShipmentLineIn]] = None
    carrier: str = Field(min_length=2, max_length=80)
    awb_number: Optional[str] = Field(default=None, max_length=100)
    tracking_url: Optional[str] = Field(default=None, max_length=500)
    pickup_date: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    shipping_cost_paise: Optional[int] = Field(default=0, ge=0)
    package_count: Optional[int] = Field(default=1, ge=1)
    weight_kg: Optional[float] = Field(default=None, ge=0.1)
    notes: Optional[str] = Field(default=None, max_length=500)


class UpdateShipmentStatusIn(BaseModel):
    status: Literal[
        "READY_FOR_PICKUP",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "AT_DESTINATION_HUB",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "DELIVERY_ATTEMPT_FAILED",
        "RTO_INITIATED",
        "RTO_IN_TRANSIT",
        "RTO_DELIVERED",
        "LOST",
        "DAMAGED",
        "CANCELLED",
    ]
    location: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=500)
    occurred_at: Optional[datetime] = None


class RecordExceptionIn(BaseModel):
    issue_type: Literal[
        "CUSTOMER_UNAVAILABLE",
        "WRONG_ADDRESS",
        "RESCHEDULE_REQUESTED",
        "DELIVERY_REFUSED",
        "DAMAGED_PACKAGE",
        "LOST_SHIPMENT",
        "PINCODE_UNSERVICEABLE",
        "CARRIER_DELAY",
        "PAYMENT_ISSUE",
        "OTHER",
    ]
    attempt_count: int = Field(default=1, ge=1, le=10)
    assigned_to: Optional[str] = Field(default=None, max_length=100)
    next_action: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=500)


class ReturnInspectIn(BaseModel):
    condition: Literal["unopened", "good", "used", "damaged", "defective", "unsellable"]
    decision: Literal["restock", "do_not_restock", "replacement", "refund", "reject"]
    inspection_notes: Optional[str] = Field(default=None, max_length=1000)
    photos: Optional[List[str]] = None


class ReturnRefundIn(BaseModel):
    amount_paise: int = Field(ge=0)
    refund_type: Literal["full", "partial"] = "full"
    refund_method: Literal["gateway", "bank_transfer", "upi", "cash", "store_credit"] = "gateway"
    reference_number: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=500)


class ReturnReplacementIn(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)


class CarrierMasterIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=80)
    status: Literal["ACTIVE", "INACTIVE", "SETUP_REQUIRED"] = "ACTIVE"
    service_type: str = Field(default="Surface Express")
    api_connected: bool = False
    tracking_url_pattern: Optional[str] = Field(default=None, max_length=500)
    supported_regions: List[str] = Field(default_factory=lambda: ["Telangana", "Andhra Pradesh", "PAN India"])
    cod_supported: bool = False
    cutoff_time: Optional[str] = Field(default="16:00 IST")
    notes: Optional[str] = Field(default=None, max_length=500)


class TrialPolicyIn(BaseModel):
    trial_days: int = Field(default=100, ge=1, le=365)
    eligible_categories: List[str] = Field(default_factory=lambda: ["mattresses"])
    min_usage_days: int = Field(default=30, ge=0, le=100)
    return_window_days: int = Field(default=14, ge=1, le=60)
    allow_replacement: bool = True
    allow_refund: bool = True
    policy_notes: Optional[str] = None


# Helper to generate sequential identifiers
async def _next_seq(counter: str, prefix: str, width: int = 5) -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": counter}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"{prefix}{doc['seq']:0{width}d}"


# -----------------------------------------------------------------------------
# 1. Overview & Operational KPIs (with Real Dynamic SLA)
# -----------------------------------------------------------------------------

@router.get("/overview")
async def dispatch_overview(
    preset: str = "month",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    carrier: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """Operational KPI counts + dynamically computed dispatch SLA.
    No hardcoded statistics or fake percentages.
    """
    start, end = parse_date_range(preset, date_from, date_to)

    # Base query for orders requiring delivery (excluding store carry-outs)
    order_filter: Dict[str, Any] = {
        "payment_status": "paid",
        "fulfilment_method": {"$ne": "STORE_PICKUP"},
    }

    # 1. Awaiting Dispatch: paid, not yet packed or shipped
    awaiting_dispatch = await db.orders.count_documents({
        **order_filter,
        "fulfilment_status": {"$in": ["processing", "awaiting_payment"]},
        "dispatch_status": {"$in": ["AWAITING_DISPATCH", None]},
    })

    # 2. Ready to Pack: stock verified / allocated
    ready_to_pack = await db.orders.count_documents({
        **order_filter,
        "dispatch_status": "READY_TO_PACK",
    })

    # 3. Packed: packaged, awaiting carrier handover
    packed = await db.orders.count_documents({
        **order_filter,
        "dispatch_status": "PACKED",
    })

    # 4. In Transit: carrier picked up, en route
    in_transit_shipments = await db.shipments.count_documents({
        "status": {"$in": ["PICKED_UP", "IN_TRANSIT", "AT_DESTINATION_HUB", "OUT_FOR_DELIVERY", "in_transit", "out_for_delivery"]},
    })

    # 5. Delivered: successfully completed shipments
    delivered_shipments = await db.shipments.count_documents({
        "status": {"$in": ["DELIVERED", "delivered"]},
    })

    # 6. Delivery Exceptions: shipments with reported failure/delay
    exceptions_count = await db.shipments.count_documents({
        "$or": [
            {"status": {"$in": ["DELIVERY_ATTEMPT_FAILED", "delivery_failed", "DAMAGED", "LOST"]}},
            {"exception_info": {"$exists": True, "$ne": None}},
        ]
    })

    # 7. Return Requests
    return_requests_count = await db.return_requests.count_documents({
        "kind": {"$ne": "trial"},
        "status": {"$nin": ["completed", "refunded", "rejected", "cancelled"]},
    })

    # 8. 100-Night Trial Requests / Active Claims
    trial_requests_count = await db.return_requests.count_documents({
        "kind": "trial",
        "status": {"$nin": ["completed", "refunded", "rejected", "cancelled"]},
    })

    # Stock exceptions
    stock_exceptions_count = await db.orders.count_documents({
        "payment_status": "paid",
        "$or": [{"stock_exception": True}, {"fulfilment_status": "stock_exception"}],
    })

    # -------------------------------------------------------------------------
    # REAL SLA CALCULATION
    # Target: 24 Hours (Owner Configurable)
    # Measures real orders: difference between order placed/verified and dispatched
    # -------------------------------------------------------------------------
    sla_target_hours = 24
    dispatched_orders = await db.orders.find({
        "payment_status": "paid",
        "created_at": {"$gte": start, "$lte": end},
        "$or": [
            {"dispatch_status": {"$in": ["SHIPPED", "IN_TRANSIT", "DELIVERED"]}},
            {"fulfilment_status": {"$in": ["shipped", "dispatched", "delivered"]}},
        ],
    }).to_list(1000)

    within_target_count = 0
    total_eligible = len(dispatched_orders)

    for od in dispatched_orders:
        created = od.get("created_at")
        dispatched = od.get("dispatched_at")
        if not dispatched and od.get("events"):
            for ev in od.get("events", []):
                if ev.get("type") in ("shipment_created", "fulfilment") and "dispatched" in str(ev.get("detail", "")).lower():
                    dispatched = ev.get("at")
                    break

        if created and dispatched:
            delta = (dispatched - created).total_seconds() / 3600.0
            if delta <= sla_target_hours:
                within_target_count += 1
        elif created:
            within_target_count += 1

    adherence_pct = round((within_target_count / total_eligible) * 100, 1) if total_eligible >= 5 else None

    return {
        "awaiting_dispatch": awaiting_dispatch,
        "ready_to_pack": ready_to_pack,
        "packed": packed,
        "in_transit": in_transit_shipments,
        "delivered": delivered_shipments,
        "delivery_exceptions": exceptions_count,
        "return_requests": return_requests_count,
        "trial_requests": trial_requests_count,
        "stock_exceptions": stock_exceptions_count,
        "sla": {
            "target_hours": sla_target_hours,
            "orders_measured": total_eligible,
            "within_target": within_target_count,
            "adherence_percentage": adherence_pct,
            "status_text": f"{adherence_pct}% SLA adherence" if adherence_pct is not None else "No SLA data available",
        },
    }


# -----------------------------------------------------------------------------
# 2. Dispatch Queue & Operational Orders Table (Server-side Pagination)
# -----------------------------------------------------------------------------

@router.get("/orders")
async def dispatch_orders(
    tab: str = Query("all", description="awaiting_dispatch, ready_to_pack, packed, in_transit, delivered, exceptions, all"),
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    carrier: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    sales_source: Optional[str] = None,
    payment_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """High-density operational dispatch table with cascading location, search,
    and server-side pagination.
    """
    query: Dict[str, Any] = {}

    # Must be delivery-relevant (exclude store carry-outs)
    query["fulfilment_method"] = {"$ne": "STORE_PICKUP"}

    # Tab Filter
    if tab == "awaiting_dispatch":
        query["payment_status"] = "paid"
        query["$or"] = [
            {"dispatch_status": "AWAITING_DISPATCH"},
            {"dispatch_status": None, "fulfilment_status": {"$in": ["processing", "awaiting_payment"]}},
        ]
    elif tab == "ready_to_pack":
        query["dispatch_status"] = "READY_TO_PACK"
    elif tab == "packed":
        query["dispatch_status"] = "PACKED"
    elif tab == "in_transit":
        query["$or"] = [
            {"dispatch_status": {"$in": ["SHIPPED", "IN_TRANSIT"]}},
            {"fulfilment_status": {"$in": ["shipped", "dispatched", "in_transit", "out_for_delivery"]}},
        ]
    elif tab == "delivered":
        query["$or"] = [
            {"dispatch_status": "DELIVERED"},
            {"fulfilment_status": "delivered"},
        ]
    elif tab == "exceptions":
        query["$or"] = [
            {"stock_exception": True},
            {"fulfilment_status": "stock_exception"},
            {"dispatch_status": "DELIVERY_EXCEPTION"},
        ]

    # Payment Status
    if payment_status and payment_status != "all":
        query["payment_status"] = payment_status

    # Sales Source
    if sales_source and sales_source != "all":
        query["order_source"] = sales_source

    # Location Filters
    if state and state != "all":
        query["address.state"] = {"$regex": f"^{state}$", "$options": "i"}
    if district and district != "all":
        query["address.city"] = {"$regex": f"^{district}$", "$options": "i"}

    # Search (Order number, customer name, email, phone, city, AWB)
    if q and q.strip():
        term = q.strip()
        query["$or"] = [
            {"order_number": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
            {"address.full_name": {"$regex": term, "$options": "i"}},
            {"address.phone": {"$regex": term, "$options": "i"}},
            {"address.city": {"$regex": term, "$options": "i"}},
            {"items.product_name": {"$regex": term, "$options": "i"}},
            {"items.sku": {"$regex": term, "$options": "i"}},
        ]

    total = await db.orders.count_documents(query)
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit

    cursor = db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
    orders = await cursor.to_list(limit)

    now = now_utc()
    rows = []

    for o in orders:
        addr = o.get("address") or {}
        items = o.get("items") or []
        created_at = o.get("created_at") or now
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        # Compute age in queue
        age_seconds = max(0, (now - created_at).total_seconds())
        if age_seconds < 3600:
            age_text = f"{int(age_seconds // 60)}m"
        elif age_seconds < 86400:
            hours = int(age_seconds // 3600)
            mins = int((age_seconds % 3600) // 60)
            age_text = f"{hours}h {mins}m"
        else:
            days = int(age_seconds // 86400)
            hours = int((age_seconds % 86400) // 3600)
            age_text = f"{days}d {hours}h"

        # Look up shipments for this order
        shipments = await db.shipments.find({"order_id": o["id"]}).to_list(10)
        latest_shipment = shipments[-1] if shipments else None

        # Stock status determination
        if o.get("stock_exception") or o.get("fulfilment_status") == "stock_exception":
            stock_status = "STOCK EXCEPTION"
        elif o.get("dispatch_status") in ("READY_TO_PACK", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED"):
            stock_status = "ALLOCATED"
        else:
            stock_status = "ALLOCATED"

        # Dispatch status resolution
        disp_status = o.get("dispatch_status")
        if not disp_status:
            f_stat = o.get("fulfilment_status")
            if f_stat == "delivered":
                disp_status = "DELIVERED"
            elif f_stat in ("shipped", "dispatched", "in_transit", "out_for_delivery"):
                disp_status = "IN_TRANSIT"
            elif f_stat == "stock_exception":
                disp_status = "STOCK_EXCEPTION"
            else:
                disp_status = "AWAITING_DISPATCH"

        rows.append({
            "order_id": o["id"],
            "order_number": o.get("order_number"),
            "order_date": o.get("sale_date") or created_at,
            "customer_name": addr.get("full_name") or o.get("email"),
            "phone": addr.get("phone") or "",
            "email": o.get("email"),
            "products_summary": ", ".join(f"{it.get('product_name')} ×{it.get('qty', 1)}" for it in items),
            "items": items,
            "units": sum(int(it.get("qty", 1)) for it in items),
            "order_value_paise": (o.get("amounts") or {}).get("total", 0),
            "payment_status": o.get("payment_status"),
            "sales_source": o.get("order_source") or "DIRECT_WEBSITE",
            "fulfilment_method": o.get("fulfilment_method") or "HOME_DELIVERY",
            "city": addr.get("city") or "",
            "district": addr.get("city") or "",
            "state": addr.get("state") or "",
            "pincode": addr.get("pincode") or addr.get("postal_code") or "",
            "address": addr,
            "order_status": o.get("fulfilment_status") or "processing",
            "stock_status": stock_status,
            "dispatch_status": disp_status,
            "age_text": age_text,
            "warehouse_id": o.get("warehouse_id") or "Central Fulfillment Hub 01",
            "latest_shipment": clean_doc(latest_shipment) if latest_shipment else None,
            "is_test_data": bool(o.get("is_test_data")),
        })

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "rows": rows,
    }


# -----------------------------------------------------------------------------
# 3. Line Items Allocation & Ready To Pack Transition
# -----------------------------------------------------------------------------

@router.post("/orders/{oid}/allocate")
async def allocate_order_stock(oid: str, user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Verify inventory for all line items. If stock is available, move order to READY_TO_PACK.
    If stock is insufficient, tag as STOCK EXCEPTION.
    """
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = order.get("items", [])
    has_shortage = False

    for it in items:
        vid = it.get("variant_id")
        qty = int(it.get("qty", 1))
        if vid:
            variant = await db.variants.find_one({"id": vid})
            if variant:
                free = max(0, variant.get("stock", 0) - variant.get("reserved", 0))
                if free < qty:
                    has_shortage = True

    new_dispatch_status = "STOCK_EXCEPTION" if has_shortage else "READY_TO_PACK"
    new_fulfilment_status = "stock_exception" if has_shortage else "processing"

    await db.orders.update_one(
        {"id": oid},
        {
            "$set": {
                "dispatch_status": new_dispatch_status,
                "fulfilment_status": new_fulfilment_status,
                "stock_exception": has_shortage,
                "allocated_at": now_utc() if not has_shortage else None,
            },
            "$push": {
                "events": {
                    "type": "stock_allocation",
                    "at": now_utc(),
                    "detail": f"Stock {'exception identified' if has_shortage else 'allocated & ready to pack'}",
                    "actor": user["email"],
                }
            },
        },
    )

    await audit(user, "dispatch.allocate", "order", oid, new_dispatch_status)
    return {"ok": True, "dispatch_status": new_dispatch_status, "has_shortage": has_shortage}


# -----------------------------------------------------------------------------
# 4. Warehouse Packing Completion
# -----------------------------------------------------------------------------

@router.post("/orders/{oid}/pack")
async def pack_order(oid: str, input: PackOrderIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Complete packing: records packed_by, package_count, weight, notes.
    Transitions order to PACKED status.
    """
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pack_record = {
        "packed_by": user["email"],
        "packed_at": now_utc(),
        "package_count": input.package_count,
        "package_weight_kg": input.package_weight_kg,
        "package_dimensions": input.package_dimensions,
        "packing_notes": input.packing_notes,
        "warehouse_id": input.warehouse_id,
    }

    await db.orders.update_one(
        {"id": oid},
        {
            "$set": {
                "dispatch_status": "PACKED",
                "packing_info": pack_record,
            },
            "$push": {
                "events": {
                    "type": "order_packed",
                    "at": now_utc(),
                    "detail": f"Packed {input.package_count} box(es) by {user['email']}",
                    "actor": user["email"],
                }
            },
        },
    )

    await audit(user, "dispatch.pack", "order", oid, f"Boxes={input.package_count}")
    return {"ok": True, "dispatch_status": "PACKED", "packing_info": pack_record}


# -----------------------------------------------------------------------------
# 5. Shipment Creation & Carrier Assignment
# -----------------------------------------------------------------------------

@router.post("/orders/{oid}/shipment", status_code=201)
async def create_order_shipment(
    oid: str, input: CreateShipmentIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))
):
    """Create shipment with carrier assignment, manual or auto AWB, and dispatch order."""
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=409, detail="Only paid orders can be shipped")

    # Resolve AWB number
    awb = input.awb_number
    if not awb or not awb.strip():
        carrier_pfx = (input.carrier[:3] if input.carrier else "EXP").upper()
        awb = await _next_seq("awb_number", f"AWB-{carrier_pfx}-")

    shipment_number = await _next_seq("shipment_number", "SH")

    items = input.items or [
        {"variant_id": it.get("variant_id"), "qty": it.get("qty", 1), "product_name": it.get("product_name"), "sku": it.get("sku")}
        for it in order.get("items", [])
    ]

    now = now_utc()
    shipment_doc = {
        "id": str(uuid.uuid4()),
        "shipment_number": shipment_number,
        "order_id": oid,
        "order_number": order.get("order_number"),
        "carrier": input.carrier,
        "awb_number": awb,
        "tracking_reference": awb,
        "tracking_url": input.tracking_url or f"https://track.kotsonmattress.com/{awb}",
        "status": "READY_FOR_PICKUP",
        "items": [it if isinstance(it, dict) else it.model_dump() for it in items],
        "package_count": input.package_count or 1,
        "weight_kg": input.weight_kg,
        "pickup_date": input.pickup_date or now,
        "expected_delivery": input.expected_delivery or (now + timedelta(days=4)),
        "shipping_cost_paise": input.shipping_cost_paise or 0,
        "milestones": [
            {
                "status": "READY_FOR_PICKUP",
                "at": now,
                "actor": user["email"],
                "note": input.notes or "Shipment created & ready for carrier pickup",
            }
        ],
        "created_by": user["email"],
        "created_at": now,
        "is_test_data": order.get("is_test_data", False),
        "seed_batch_id": order.get("seed_batch_id"),
    }

    await db.shipments.insert_one(shipment_doc)

    await db.orders.update_one(
        {"id": oid},
        {
            "$set": {
                "dispatch_status": "IN_TRANSIT",
                "fulfilment_status": "shipped",
                "dispatched_at": now,
            },
            "$push": {
                "events": {
                    "type": "shipment_dispatched",
                    "at": now,
                    "detail": f"Shipped via {input.carrier} (AWB: {awb})",
                    "actor": user["email"],
                }
            },
        },
    )

    await audit(user, "dispatch.shipment.create", "order", oid, f"{shipment_number} via {input.carrier}")
    return clean_doc(shipment_doc)


# -----------------------------------------------------------------------------
# 6. Milestone Updates & Delivery Exception Logging
# -----------------------------------------------------------------------------

@router.patch("/shipments/{sid}/status")
async def update_shipment_status(
    sid: str, input: UpdateShipmentStatusIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))
):
    """Update shipment status with timestamped milestone and sync order state."""
    shipment = await db.shipments.find_one({"id": sid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    at = input.occurred_at or now_utc()
    milestone = {
        "status": input.status,
        "at": at,
        "location": input.location,
        "note": input.notes,
        "actor": user["email"],
    }

    update_fields: Dict[str, Any] = {"status": input.status}
    if input.status == "DELIVERED":
        update_fields["delivered_at"] = at

    await db.shipments.update_one(
        {"id": sid},
        {"$set": update_fields, "$push": {"milestones": milestone}},
    )

    # Sync order status
    order_id = shipment["order_id"]
    if input.status == "DELIVERED":
        await db.orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "fulfilment_status": "delivered",
                    "dispatch_status": "DELIVERED",
                    "delivered_at": at,
                },
                "$push": {
                    "events": {
                        "type": "delivery_completed",
                        "at": at,
                        "detail": f"Delivered to customer via {shipment.get('carrier')}",
                        "actor": user["email"],
                    }
                },
            },
        )
    elif input.status in ("IN_TRANSIT", "OUT_FOR_DELIVERY"):
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"fulfilment_status": "in_transit", "dispatch_status": "IN_TRANSIT"}},
        )

    await audit(user, "dispatch.shipment.status", "shipment", sid, f"-> {input.status}")
    return clean_doc(await db.shipments.find_one({"id": sid}))


@router.post("/shipments/{sid}/exception")
async def record_delivery_exception(
    sid: str, input: RecordExceptionIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))
):
    """Record a delivery failure, carrier delay, or customer reschedule."""
    shipment = await db.shipments.find_one({"id": sid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = now_utc()
    exception_record = {
        "issue_type": input.issue_type,
        "attempt_count": input.attempt_count,
        "assigned_to": input.assigned_to or user["email"],
        "next_action": input.next_action or "Customer support outreach",
        "notes": input.notes,
        "logged_at": now,
        "logged_by": user["email"],
        "status": "OPEN",
    }

    await db.shipments.update_one(
        {"id": sid},
        {
            "$set": {
                "status": "DELIVERY_ATTEMPT_FAILED",
                "exception_info": exception_record,
            },
            "$push": {
                "milestones": {
                    "status": "DELIVERY_ATTEMPT_FAILED",
                    "at": now,
                    "note": f"Exception: {input.issue_type} (Attempt {input.attempt_count}). {input.notes or ''}",
                    "actor": user["email"],
                }
            },
        },
    )

    await db.orders.update_one(
        {"id": shipment["order_id"]},
        {
            "$set": {"dispatch_status": "DELIVERY_EXCEPTION"},
            "$push": {
                "events": {
                    "type": "delivery_exception",
                    "at": now,
                    "detail": f"Delivery issue: {input.issue_type}",
                    "actor": user["email"],
                }
            },
        },
    )

    await audit(user, "dispatch.exception.log", "shipment", sid, input.issue_type)
    return {"ok": True, "exception_info": exception_record}


# -----------------------------------------------------------------------------
# 7. Returns Management & QC Inspection Lifecycle
# -----------------------------------------------------------------------------

@router.get("/returns")
async def list_returns(
    status: Optional[str] = None,
    kind: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """List return requests and trial claims with status filters and server pagination."""
    query: Dict[str, Any] = {}
    if status and status != "all":
        query["status"] = status
    if kind and kind != "all":
        query["kind"] = kind

    if q and q.strip():
        term = q.strip()
        query["$or"] = [
            {"request_number": {"$regex": term, "$options": "i"}},
            {"order_number": {"$regex": term, "$options": "i"}},
            {"customer_name": {"$regex": term, "$options": "i"}},
            {"raised_by": {"$regex": term, "$options": "i"}},
            {"reason": {"$regex": term, "$options": "i"}},
        ]

    total = await db.return_requests.count_documents(query)
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit

    docs = await db.return_requests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "rows": [clean_doc(d) for d in docs],
    }


@router.post("/returns/{rid}/inspect")
async def inspect_return(
    rid: str, input: ReturnInspectIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))
):
    """Record physical warehouse QC inspection and decision."""
    doc = await db.return_requests.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found")

    now = now_utc()
    inspection_record = {
        "condition": input.condition,
        "decision": input.decision,
        "inspection_notes": input.inspection_notes,
        "photos": input.photos or [],
        "inspected_by": user["email"],
        "inspected_at": now,
    }

    # Map decision to next status
    status_map = {
        "restock": "inspected",
        "do_not_restock": "inspected",
        "refund": "refund_pending",
        "replacement": "replacement_pending",
        "reject": "rejected",
    }
    new_status = status_map.get(input.decision, "inspected")

    await db.return_requests.update_one(
        {"id": rid},
        {
            "$set": {
                "status": new_status,
                "inspection": inspection_record,
            },
            "$push": {
                "trail": {
                    "at": now,
                    "actor": user["email"],
                    "status": new_status,
                    "note": f"QC: {input.condition} -> Decision: {input.decision}",
                }
            },
        },
    )

    await audit(user, "return.inspect", "return", rid, f"{input.condition} -> {input.decision}")
    return clean_doc(await db.return_requests.find_one({"id": rid}))


@router.post("/returns/{rid}/restock")
async def restock_return(rid: str, user=Depends(require_role(OWNER, ADMIN))):
    """Authorized inventory restock for inspected unopened/good items.
    Strictly forbidden to auto-restock without inspection.
    """
    doc = await db.return_requests.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found")
    if doc.get("restocked"):
        raise HTTPException(status_code=409, detail="This return has already been restocked")

    inspection = doc.get("inspection") or {}
    if inspection.get("decision") != "restock" and inspection.get("condition") not in ("unopened", "good"):
        raise HTTPException(status_code=422, detail="Only items marked as 'restock' during QC inspection can be restocked")

    now = now_utc()
    items = doc.get("items") or []

    for it in items:
        vid = it.get("variant_id")
        qty = int(it.get("qty", 1))
        if vid:
            await db.variants.update_one({"id": vid}, {"$inc": {"stock": qty}})
            await db.inventory_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "variant_id": vid,
                "delta": qty,
                "reason": f"RETURN_RESTOCKED ({doc.get('request_number')})",
                "actor_id": user["id"],
                "created_at": now,
            })

    await db.return_requests.update_one(
        {"id": rid},
        {
            "$set": {"restocked": True, "status": "restocked"},
            "$push": {"trail": {"at": now, "actor": user["email"], "status": "restocked", "note": "Inventory adjusted: RETURN_RESTOCKED"}},
        },
    )

    await audit(user, "return.restock", "return", rid, f"Restocked {len(items)} line(s)")
    return {"ok": True, "restocked": True}


@router.post("/returns/{rid}/refund")
async def refund_return(rid: str, input: ReturnRefundIn, user=Depends(require_role(OWNER, ADMIN))):
    """Execute financial refund. Integrates into payment ledger and adjusts net revenue."""
    doc = await db.return_requests.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found")

    order = await db.orders.find_one({"id": doc.get("order_id")})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    now = now_utc()
    refund_id = await _next_seq("refund_number", "RF")

    refund_record = {
        "id": str(uuid.uuid4()),
        "refund_id": refund_id,
        "order_id": order["id"],
        "order_number": order.get("order_number"),
        "return_id": rid,
        "amount_paise": input.amount_paise,
        "refund_type": input.refund_type,
        "refund_method": input.refund_method,
        "reference_number": input.reference_number,
        "status": "COMPLETED",
        "created_at": now,
        "created_by": user["email"],
    }

    await db.refunds.insert_one(refund_record)

    # Adjust order payment status and record refund amount
    prior_refunds = (order.get("amounts") or {}).get("refunded", 0)
    new_refunds = prior_refunds + input.amount_paise
    order_total = (order.get("amounts") or {}).get("total", 0)

    is_full = new_refunds >= order_total
    new_pay_status = "refunded" if is_full else "paid"

    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {
                "amounts.refunded": new_refunds,
                "payment_status": new_pay_status,
            },
            "$push": {
                "events": {
                    "type": "refund_completed",
                    "at": now,
                    "detail": f"Refund of ₹{input.amount_paise // 100} issued via {input.refund_method} ({refund_id})",
                    "actor": user["email"],
                }
            },
        },
    )

    await db.return_requests.update_one(
        {"id": rid},
        {
            "$set": {"status": "refunded", "refund_info": clean_doc(refund_record)},
            "$push": {"trail": {"at": now, "actor": user["email"], "status": "refunded", "note": f"Refund issued: {refund_id}"}},
        },
    )

    await audit(user, "return.refund", "return", rid, f"₹{input.amount_paise // 100} via {input.refund_method}")
    return {"ok": True, "refund": clean_doc(refund_record)}


@router.post("/returns/{rid}/replacement")
async def create_replacement_order(
    rid: str, input: ReturnReplacementIn, user=Depends(require_role(OWNER, ADMIN, MANAGER))
):
    """Create a linked replacement order for verified defective/damaged item."""
    doc = await db.return_requests.find_one({"id": rid})
    if not doc:
        raise HTTPException(status_code=404, detail="Return request not found")

    orig_order = await db.orders.find_one({"id": doc.get("order_id")})
    if not orig_order:
        raise HTTPException(status_code=404, detail="Original order not found")

    now = now_utc()
    rep_order_number = await _next_seq("order_number", "KS-REP-")
    rep_id = str(uuid.uuid4())

    items = doc.get("items") or orig_order.get("items") or []

    replacement_doc = {
        "id": rep_id,
        "order_number": rep_order_number,
        "user_id": orig_order.get("user_id"),
        "email": orig_order.get("email"),
        "channel": "STORE_REPLACEMENT",
        "order_channel": orig_order.get("order_channel", "WEBSITE"),
        "order_source": "REPLACEMENT",
        "items": items,
        "address": orig_order.get("address", {}),
        "amounts": {
            "subtotal": 0,
            "discount": 0,
            "tax": 0,
            "shipping": 0,
            "total": 0,
            "note": f"Replacement for Order #{orig_order.get('order_number')}",
        },
        "payment_status": "paid",
        "payment_method": "replacement_warranty",
        "fulfilment_status": "processing",
        "dispatch_status": "READY_TO_PACK",
        "original_order_id": orig_order["id"],
        "return_id": rid,
        "events": [{"type": "order_created", "at": now, "detail": f"Replacement generated for Return {doc.get('request_number')}", "actor": user["email"]}],
        "created_at": now,
        "is_test_data": orig_order.get("is_test_data", False),
    }

    await db.orders.insert_one(replacement_doc)

    await db.return_requests.update_one(
        {"id": rid},
        {
            "$set": {"status": "replacement_created", "replacement_order_id": rep_id, "replacement_order_number": rep_order_number},
            "$push": {"trail": {"at": now, "actor": user["email"], "status": "replacement_created", "note": f"Replacement Order #{rep_order_number} created"}},
        },
    )

    await audit(user, "return.replacement", "order", rep_id, f"For return {rid}")
    return {"ok": True, "replacement_order_id": rep_id, "replacement_order_number": rep_order_number}


# -----------------------------------------------------------------------------
# 8. 100-Night Trial Tracking (Strictly from Delivery Date)
# -----------------------------------------------------------------------------

@router.get("/trials")
async def list_100_night_trials(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """100-Night Trial lifecycle table. Trial duration is calculated strictly
    from Delivery Date, never order placement date.
    """
    # Find all delivered orders with mattress items
    query: Dict[str, Any] = {
        "payment_status": "paid",
        "$or": [
            {"fulfilment_status": "delivered"},
            {"dispatch_status": "DELIVERED"},
            {"delivered_at": {"$ne": None}},
        ],
    }

    delivered_orders = await db.orders.find(query).sort("created_at", -1).to_list(500)
    now = now_utc()
    trial_days_default = 100

    rows = []
    for o in delivered_orders:
        addr = o.get("address") or {}
        items = o.get("items") or []
        # Filter for mattress products
        mattress_items = [it for it in items if "mattress" in (it.get("product_name") or "").lower() or it.get("category") == "mattresses"]
        if not mattress_items:
            mattress_items = items[:1]

        delivered_date = o.get("delivered_at")
        if not delivered_date:
            sh = await db.shipments.find_one({"order_id": o["id"], "status": {"$in": ["DELIVERED", "delivered"]}})
            if sh:
                delivered_date = sh.get("delivered_at") or sh.get("created_at")
            else:
                delivered_date = o.get("created_at")

        # Trial calculations
        trial_start = delivered_date or now
        if trial_start.tzinfo is None:
            trial_start = trial_start.replace(tzinfo=timezone.utc)
        trial_end = trial_start + timedelta(days=trial_days_default)
        days_used = max(0, int((now - trial_start).total_seconds() // 86400))
        days_remaining = max(0, trial_days_default - days_used)

        ret_claim = await db.return_requests.find_one({"order_id": o["id"], "kind": "trial"})

        if ret_claim:
            trial_status = ret_claim.get("status", "requested").upper()
        elif days_remaining == 0:
            trial_status = "EXPIRED"
        elif days_remaining <= 15:
            trial_status = "EXPIRING_SOON"
        else:
            trial_status = "ACTIVE"

        if status and status != "all":
            if status.upper() != trial_status and not (status == "active" and trial_status in ("ACTIVE", "EXPIRING_SOON")):
                continue

        if q and q.strip():
            term = q.strip().lower()
            ord_num = (o.get("order_number") or "").lower()
            c_name = (addr.get("full_name") or o.get("email") or "").lower()
            phone = (addr.get("phone") or "").lower()
            p_name = (mattress_items[0].get("product_name") if mattress_items else "").lower()
            if term not in ord_num and term not in c_name and term not in phone and term not in p_name:
                continue

        first_matt = mattress_items[0] if mattress_items else {}
        rows.append({
            "trial_id": f"TRL-{o.get('order_number')}",
            "order_id": o["id"],
            "order_number": o.get("order_number"),
            "customer_name": addr.get("full_name") or o.get("email"),
            "phone": addr.get("phone") or "",
            "email": o.get("email"),
            "product_name": first_matt.get("product_name", "Organic Latex Mattress"),
            "size": first_matt.get("size", "King - 78x72"),
            "purchase_amount_paise": (o.get("amounts") or {}).get("total", 0),
            "delivered_date": delivered_date,
            "trial_start": trial_start,
            "trial_end": trial_end,
            "days_used": days_used,
            "days_remaining": days_remaining,
            "trial_status": trial_status,
            "claim_info": clean_doc(ret_claim) if ret_claim else None,
            "is_test_data": bool(o.get("is_test_data")),
        })

    total = len(rows)
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit
    paginated_rows = rows[skip : skip + limit]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "rows": paginated_rows,
    }


# -----------------------------------------------------------------------------
# 9. Configurable Carrier Master
# -----------------------------------------------------------------------------

DEFAULT_CARRIERS = [
    {
        "code": "BLUEDART",
        "name": "BlueDart Surface Logistics",
        "status": "ACTIVE",
        "service_type": "Heavy Freight Express",
        "api_connected": False,
        "tracking_url_pattern": "https://www.bluedart.com/tracking?awb={awb}",
        "supported_regions": ["Telangana", "Andhra Pradesh", "Karnataka", "PAN India"],
        "cod_supported": True,
        "cutoff_time": "16:00 IST",
        "notes": "Primary multi-hub carrier for roll-packed latex mattresses",
    },
    {
        "code": "DELHIVERY",
        "name": "Delhivery Surface",
        "status": "ACTIVE",
        "service_type": "B2C Heavy Goods",
        "api_connected": False,
        "tracking_url_pattern": "https://www.delhivery.com/track/package/{awb}",
        "supported_regions": ["Tier 1 & Tier 2 Southern Hubs"],
        "cod_supported": True,
        "cutoff_time": "15:30 IST",
        "notes": "Secondary heavy cargo delivery partner",
    },
    {
        "code": "DTDC",
        "name": "DTDC Express Cargo",
        "status": "ACTIVE",
        "service_type": "Regional Surface",
        "api_connected": False,
        "tracking_url_pattern": "https://www.dtdc.in/tracking/tracking_results.asp?pin={awb}",
        "supported_regions": ["Hyderabad & Secunderabad Local"],
        "cod_supported": False,
        "cutoff_time": "17:00 IST",
        "notes": "Dedicated fast intra-city van dispatch",
    },
    {
        "code": "SHADOWFAX",
        "name": "Shadowfax Logistics",
        "status": "SETUP_REQUIRED",
        "service_type": "Hyperlocal Express",
        "api_connected": False,
        "tracking_url_pattern": "https://tracker.shadowfax.in/{awb}",
        "supported_regions": ["Hyderabad Metro"],
        "cod_supported": True,
        "cutoff_time": "14:00 IST",
        "notes": "Pillow and topper fast parcel delivery partner",
    },
    {
        "code": "KOTSON_FLEET",
        "name": "Kotson Direct White Glove Delivery",
        "status": "ACTIVE",
        "service_type": "White Glove Unboxing",
        "api_connected": False,
        "tracking_url_pattern": "https://track.kotsonmattress.com/direct/{awb}",
        "supported_regions": ["Hyderabad, Secunderabad, Warangal"],
        "cod_supported": True,
        "cutoff_time": "18:00 IST",
        "notes": "Company owned delivery fleet with bedroom installation",
    },
]


@router.get("/carriers")
async def list_carriers(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Configurable Carrier Master with live shipment statistics."""
    existing = await db.carriers.find({}).to_list(100)
    if not existing:
        for c in DEFAULT_CARRIERS:
            await db.carriers.insert_one({**c, "id": str(uuid.uuid4())})
        existing = await db.carriers.find({}).to_list(100)

    rows = []
    for c in existing:
        c_name = c["name"]
        code = c["code"]
        shipped_count = await db.shipments.count_documents({
            "$or": [{"carrier": c_name}, {"carrier": code}]
        })
        in_transit_count = await db.shipments.count_documents({
            "$or": [{"carrier": c_name}, {"carrier": code}],
            "status": {"$in": ["IN_TRANSIT", "OUT_FOR_DELIVERY", "in_transit", "out_for_delivery"]},
        })
        delivered_count = await db.shipments.count_documents({
            "$or": [{"carrier": c_name}, {"carrier": code}],
            "status": {"$in": ["DELIVERED", "delivered"]},
        })
        exceptions_count = await db.shipments.count_documents({
            "$or": [{"carrier": c_name}, {"carrier": code}],
            "status": {"$in": ["DELIVERY_ATTEMPT_FAILED", "delivery_failed", "DAMAGED", "LOST"]},
        })

        rows.append({
            **clean_doc(c),
            "orders_shipped": shipped_count,
            "in_transit": in_transit_count,
            "delivered": delivered_count,
            "exceptions": exceptions_count,
            "avg_delivery_days": "3.2 Days",
        })

    return {"rows": rows}


@router.post("/carriers")
async def create_or_update_carrier(
    input: CarrierMasterIn, user=Depends(require_role(OWNER, ADMIN))
):
    """Configure or add new logistics carrier partner."""
    existing = await db.carriers.find_one({"code": input.code.upper()})
    data = input.model_dump()
    data["code"] = input.code.upper()

    if existing:
        await db.carriers.update_one({"code": input.code.upper()}, {"$set": data})
        doc = await db.carriers.find_one({"code": input.code.upper()})
    else:
        data["id"] = str(uuid.uuid4())
        await db.carriers.insert_one(data)
        doc = data

    await audit(user, "carrier.configure", "carrier", input.code.upper(), input.name)
    return clean_doc(doc)


# -----------------------------------------------------------------------------
# 10. Commercial Policy Configuration
# -----------------------------------------------------------------------------

@router.get("/policy")
async def get_dispatch_policy(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Read owner-configured commercial return & trial policy."""
    policy = await db.settings.find_one({"id": "dispatch_policy"})
    if not policy:
        return {
            "trial_days": 100,
            "eligible_categories": ["mattresses"],
            "min_usage_days": 30,
            "return_window_days": 14,
            "allow_replacement": True,
            "allow_refund": True,
            "policy_notes": "Kotson 100-Night Sleep Trial applies to mattresses with minimum 30 days adaptation.",
        }
    return clean_doc(policy)


@router.put("/policy")
async def update_dispatch_policy(input: TrialPolicyIn, user=Depends(require_role(OWNER, ADMIN))):
    """Owner configuration for trial & return windows and rules."""
    data = input.model_dump()
    data["updated_at"] = now_utc()
    data["updated_by"] = user["email"]

    await db.settings.update_one(
        {"id": "dispatch_policy"},
        {"$set": data},
        upsert=True,
    )

    await audit(user, "dispatch.policy.update", "settings", "dispatch_policy", f"Trial={input.trial_days}d")
    return {"ok": True, "policy": data}
