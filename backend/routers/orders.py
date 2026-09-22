"""Orders: customer access (own data only), staff fulfilment transitions, refunds, exceptions."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import OWNER, audit, has_role, optional_user, require_role, require_user
from lib.services import release_order_reservations, clean_doc as svc_clean
from models.orders import Order
from models.users import utcnow

router = APIRouter()


class TransitionIn(BaseModel):
    to: str


class RefundIn(BaseModel):
    amount: int = Field(gt=0)  # paise
    reason: str = Field(min_length=3, max_length=300)


def order_public(o: dict, include_private: bool = False) -> dict:
    d = svc_clean(o)
    if not include_private:
        d.pop("guest_access_token", None)
        d.pop("cart_token", None)
    return d


@router.get("/orders", response_model=List[Order])
async def my_orders(user=Depends(require_user)):
    docs = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [Order(**order_public(d)) for d in docs]


@router.get("/orders/{oid}", response_model=Order)
async def get_order(oid: str, t: Optional[str] = None, user=Depends(optional_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    is_staff = user and has_role(user, "owner", "admin", "manager", "crm_master", "crm_manager", "crm_employee")
    is_owner_of_order = user and o.get("user_id") == user["id"]
    is_guest = t and o.get("guest_access_token") == t
    if not (is_staff or is_owner_of_order or is_guest):
        raise HTTPException(status_code=403, detail="You do not have access to this order")
    return Order(**order_public(o, include_private=bool(is_staff)))


# ---------- staff ----------

@router.get("/admin/orders", response_model=List[Order])
async def admin_orders(
    status: Optional[str] = None, payment: Optional[str] = None, q: Optional[str] = None,
    user=Depends(require_role("owner", "admin", "manager")),
):
    query: dict = {}
    if status:
        query["fulfilment_status"] = status
    if payment:
        query["payment_status"] = payment
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"order_number": {"$regex": q.strip().upper()}}, {"email": rx}]
    docs = await db.orders.find(query).sort("created_at", -1).to_list(300)
    return [Order(**order_public(d, include_private=True)) for d in docs]


MANAGER_TRANSITIONS = {"processing", "shipped", "delivered"}
TRANSITIONS = {
    "awaiting_payment": {"cancelled"},
    "processing": {"shipped", "delivered", "cancelled"},
    "shipped": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


@router.post("/admin/orders/{oid}/transition", response_model=Order)
async def transition_order(oid: str, input: TransitionIn, user=Depends(require_role("owner", "admin", "manager"))):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    to = input.to
    if to not in {"processing", "shipped", "delivered", "cancelled"}:
        raise HTTPException(status_code=422, detail="Unknown fulfilment state")
    if o.get("stock_exception"):
        raise HTTPException(status_code=409, detail="Stock exception on this order — resolve (refund/manual) before any fulfilment change")
    if not has_role(user, OWNER, "admin") and to not in MANAGER_TRANSITIONS:
        raise HTTPException(status_code=403, detail="Managers cannot cancel orders — escalation required")
    if to == "cancelled":
        if o.get("payment_status") == "paid":
            refund = await db.refunds.find_one({"order_id": oid})
            if not refund:
                raise HTTPException(status_code=409, detail="Create the refund record before cancelling a paid order")
        await release_order_reservations(oid, status="released", reason="order cancelled")
        await db.reward_ledger.update_many(
            {"order_id": oid, "status": {"$in": ["pending", "approved"]}},
            {"$set": {"status": "reversed", "reversed_at": utcnow(), "reversal_reason": "order cancelled"}},
        )
    else:
        if o.get("payment_status") != "paid":
            raise HTTPException(status_code=409, detail="Only paid orders can move through fulfilment")
        if to not in TRANSITIONS.get(o["fulfilment_status"], set()):
            raise HTTPException(status_code=409, detail=f"Cannot move from {o['fulfilment_status']} to {to}")

    updated = await db.orders.find_one_and_update(
        {"id": oid},
        {"$set": {"fulfilment_status": to},
         "$push": {"events": {"at": utcnow(), "type": f"fulfilment_{to}", "detail": f"Fulfilment state set to {to}", "actor": user["email"]}}},
        return_document=True,
    )
    await audit(user, "order.transition", "order", oid, f"-> {to}")
    return Order(**order_public(updated, include_private=True))


@router.post("/admin/orders/{oid}/refund")
async def create_refund(oid: str, input: RefundIn, user=Depends(require_role(OWNER, "admin"))):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.get("payment_status") != "paid":
        raise HTTPException(status_code=409, detail="Refunds apply to paid orders")
    if input.amount > o["amounts"]["total"]:
        raise HTTPException(status_code=422, detail="Refund exceeds order total")
    refund = {
        "id": str(uuid.uuid4()), "order_id": oid, "order_number": o["order_number"],
        "amount": input.amount, "reason": input.reason, "status": "pending_provider",
        "created_by": user["email"], "created_at": utcnow(),
    }
    await db.refunds.insert_one(refund)
    await db.orders.update_one(
        {"id": oid},
        {"$push": {"events": {"at": utcnow(), "type": "refund_recorded", "detail": f"Refund of {input.amount} paise recorded ({refund['status']})", "actor": user["email"]}}},
    )
    await audit(user, "order.refund", "order", oid, f"amount={input.amount} {input.reason}")
    return {"ok": True, "refund_id": refund["id"], "status": refund["status"]}


@router.post("/admin/orders/{oid}/resolve-exception")
async def resolve_exception(oid: str, input: RefundIn, user=Depends(require_role(OWNER, "admin"))):
    o = await db.orders.find_one({"id": oid})
    if not o or not o.get("stock_exception"):
        raise HTTPException(status_code=404, detail="No stock exception on this order")
    refund = {
        "id": str(uuid.uuid4()), "order_id": oid, "order_number": o["order_number"],
        "amount": input.amount, "reason": f"stock exception resolution: {input.reason}",
        "status": "pending_provider", "created_by": user["email"], "created_at": utcnow(),
    }
    await db.refunds.insert_one(refund)
    await db.orders.update_one(
        {"id": oid},
        {"$push": {"events": {"at": utcnow(), "type": "exception_resolved", "detail": "Captured payment escalated; documented refund initiated — manual resolution path", "actor": user["email"]}}},
    )
    await audit(user, "order.exception_resolved", "order", oid, "refund initiated for captured payment")
    return {"ok": True, "refund_id": refund["id"], "status": "pending_provider"}
