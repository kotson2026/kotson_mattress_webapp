"""Orders: customer access (own data only), staff fulfilment transitions, refunds, exceptions, manual sales, and advanced filtering."""

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import (
    ADMIN,
    OWNER,
    audit,
    has_role,
    normalize_email,
    now_utc,
    optional_user,
    require_role,
    require_user,
)
from lib.services import (
    clean_doc as svc_clean,
    consume_order_reservations,
    release_order_reservations,
    reserve_stock,
)
from models.orders import ManualSaleIn, Order
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


# ---------- staff / admin orders ----------

async def _build_order_query(
    status: Optional[str] = None,
    payment: Optional[str] = None,
    sales_source: Optional[str] = None,
    order_channel: Optional[str] = None,
    category: Optional[str] = None,
    product_id: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    pincode: Optional[str] = None,
    q: Optional[str] = None,
    dealer_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    referral_code: Optional[str] = None,
    payment_method: Optional[str] = None,
    amount_min: Optional[int] = None,
    amount_max: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    query: dict = {}
    if status and status != "ALL":
        query["fulfilment_status"] = status
    if payment and payment != "ALL":
        query["payment_status"] = payment
    if sales_source and sales_source != "ALL":
        query["order_source"] = sales_source
    if order_channel and order_channel != "ALL":
        query["order_channel"] = order_channel
    if dealer_id:
        query["dealer_id"] = dealer_id
    if employee_id:
        query["employee_id"] = employee_id
    if referral_code:
        query["referral_code"] = referral_code
    if payment_method and payment_method != "ALL":
        query["payment_method"] = payment_method

    if category and category != "ALL":
        # Resolve category products
        cat_prods = await db.products.find({"category_slug": category.strip().lower()}).to_list(200)
        p_ids = [p["id"] for p in cat_prods]
        query["items.product_id"] = {"$in": p_ids}

    if product_id:
        query["items.product_id"] = product_id

    if state and state != "ALL":
        query["address.state"] = {"$regex": f"^{state.strip()}$", "$options": "i"}
    if district and district != "ALL":
        query["address.district"] = {"$regex": f"^{district.strip()}$", "$options": "i"}
    if city and city != "ALL":
        query["address.city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}
    if pincode:
        query["address.pincode"] = pincode.strip()

    if amount_min is not None or amount_max is not None:
        amt: dict = {}
        if amount_min is not None:
            amt["$gte"] = int(amount_min)
        if amount_max is not None:
            amt["$lte"] = int(amount_max)
        query["amounts.total"] = amt

    if date_from or date_to:
        dt_cond: dict = {}
        if date_from:
            try:
                start = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                dt_cond["$gte"] = start
            except Exception:
                pass
        if date_to:
            try:
                end = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                if end.tzinfo is None:
                    end = end.replace(tzinfo=timezone.utc)
                dt_cond["$lte"] = end
            except Exception:
                pass
        if dt_cond:
            query["created_at"] = dt_cond

    if q and q.strip():
        term = q.strip()
        rx = {"$regex": term, "$options": "i"}
        search_or = [
            {"order_number": {"$regex": term.upper()}},
            {"email": rx},
            {"address.full_name": rx},
            {"address.phone": rx},
            {"items.product_name": rx},
            {"items.sku": rx},
        ]
        if "$and" in query:
            query["$and"].append({"$or": search_or})
        elif query:
            query = {"$and": [dict(query), {"$or": search_or}]}
        else:
            query["$or"] = search_or

    return query


@router.get("/admin/orders")
async def admin_orders(
    status: Optional[str] = None,
    payment: Optional[str] = None,
    sales_source: Optional[str] = None,
    order_channel: Optional[str] = None,
    category: Optional[str] = None,
    product_id: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    pincode: Optional[str] = None,
    q: Optional[str] = None,
    dealer_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    referral_code: Optional[str] = None,
    payment_method: Optional[str] = None,
    amount_min: Optional[int] = None,
    amount_max: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: Optional[int] = Query(None),
    page_size: Optional[int] = Query(None),
    raw_list: bool = Query(False),
    user=Depends(require_role("owner", "admin", "manager", "crm_master")),
):
    query = await _build_order_query(
        status=status, payment=payment, sales_source=sales_source, order_channel=order_channel,
        category=category, product_id=product_id, state=state, district=district, city=city,
        pincode=pincode, q=q, dealer_id=dealer_id, employee_id=employee_id, referral_code=referral_code,
        payment_method=payment_method, amount_min=amount_min, amount_max=amount_max,
        date_from=date_from, date_to=date_to,
    )

    total = await db.orders.count_documents(query)

    sort_field = "created_at"
    if sort_by == "sale_date":
        sort_field = "sale_date"
    elif sort_by == "total":
        sort_field = "amounts.total"
    elif sort_by == "order_number":
        sort_field = "order_number"
    elif sort_by == "customer":
        sort_field = "address.full_name"
    direction = -1 if sort_order.lower() == "desc" else 1

    p = max(1, page or 1)
    ps = max(1, min(100, page_size or 10))
    skip = (p - 1) * ps

    docs = await db.orders.find(query).sort(sort_field, direction).skip(skip).limit(ps).to_list(ps)
    cleaned = [order_public(d, include_private=True) for d in docs]

    if raw_list:
        return cleaned

    return {
        "total": total,
        "page": p,
        "page_size": ps,
        "total_pages": (total + ps - 1) // ps if ps else 1,
        "orders": cleaned,
    }


# ---------- Manual Sale Creation ----------

@router.post("/admin/orders/manual", status_code=201)
async def create_manual_sale(
    input: ManualSaleIn,
    user=Depends(require_role(OWNER, ADMIN, "manager")),
):
    """Owner/Admin/Manager adds a legitimate in-store / walk-in / phone order.
    Deducts inventory safely with ledger audit entries."""
    if not input.items:
        raise HTTPException(status_code=422, detail="At least one product line is required")

    # 1. Customer resolution
    phone_digits = "".join(filter(str.isdigit, input.mobile))[-10:]
    email_clean = normalize_email(input.email) if input.email else f"cust_{phone_digits}@kotson.local"
    
    customer = None
    if input.customer_id:
        customer = await db.users.find_one({"id": input.customer_id})
    if not customer:
        customer = await db.users.find_one({
            "$or": [
                {"phone": {"$regex": f"{phone_digits}$"}},
                {"email": email_clean},
            ]
        })
    if not customer:
        cust_id = str(uuid.uuid4())
        customer = {
            "id": cust_id,
            "email": email_clean,
            "phone": phone_digits,
            "name": input.customer_name.strip(),
            "roles": ["customer"],
            "password_hash": "",
            "is_active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(customer)

    # 2. Build Item Snapshots & Calculate totals
    items_snapshots = []
    subtotal = 0
    discount_total = 0
    reserve_requests = []

    for line in input.items:
        v = await db.variants.find_one({"id": line.variant_id})
        if not v:
            raise HTTPException(status_code=404, detail=f"Variant {line.variant_id} not found")
        p = await db.products.find_one({"id": v["product_id"]})
        unit_price = line.unit_price
        discount = line.discount
        line_total = max(0, (unit_price * line.qty) - discount)
        subtotal += (unit_price * line.qty)
        discount_total += discount

        items_snapshots.append({
            "variant_id": v["id"],
            "product_id": v["product_id"],
            "product_slug": p["slug"] if p else "",
            "product_name": p["name"] if p else v["sku"],
            "sku": v["sku"],
            "size": v["size"],
            "thickness": v.get("thickness"),
            "firmness": v.get("firmness"),
            "qty": line.qty,
            "unit_price": unit_price,
            "line_total": line_total,
        })
        reserve_requests.append({"variant_id": v["id"], "qty": line.qty})

    total_amount = max(0, subtotal - discount_total)

    # 3. Order ID & Sequential Number
    order_id = str(uuid.uuid4())
    counter = await db.counters.find_one_and_update(
        {"_id": "order_number"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    order_number = f"KS{counter['seq']:05d}"

    # 4. Inventory safety: reserve stock
    try:
        await reserve_stock(order_id, reserve_requests)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=f"Inventory shortage: {e}")

    # 5. Handle Payment & Consume stock if paid
    is_paid = input.payment_status == "paid"
    if is_paid:
        await consume_order_reservations(order_id)
        fulfilment_status = "processing"
        res_status = "consumed"
    else:
        fulfilment_status = "awaiting_payment"
        res_status = "active"

    # 6. Address
    address_doc = dict(input.address)
    if not address_doc.get("full_name"):
        address_doc["full_name"] = input.customer_name
    if not address_doc.get("phone"):
        address_doc["phone"] = input.mobile
    if not address_doc.get("email"):
        address_doc["email"] = customer["email"]

    sale_date = input.sale_date or now_utc()
    if sale_date.tzinfo is None:
        sale_date = sale_date.replace(tzinfo=timezone.utc)

    # 7. Create Order Document
    order_doc = {
        "id": order_id,
        "order_number": order_number,
        "user_id": customer["id"],
        "email": customer["email"],
        "guest_access_token": None,
        "channel": "dealer" if input.order_source == "DEALER" else "retail",
        "buyer_type": "DEALER" if input.order_source == "DEALER" else "CUSTOMER",
        "order_source": input.order_source,
        "order_channel": "ADMIN_MANUAL",
        "sale_date": sale_date,
        "employee_id": input.employee_id,
        "dealer_id": input.dealer_id,
        "source_note": input.source_note,
        "payment_verification_source": "ADMIN_RECORDED",
        "manual_payment_ref": input.manual_payment_ref,
        "manual_payment_remarks": input.payment_remarks,
        "payment_method": input.payment_method,
        "payment_status": input.payment_status,
        "fulfilment_status": fulfilment_status,
        "reservation_status": res_status,
        "items": items_snapshots,
        "address": address_doc,
        "amounts": {
            "subtotal": subtotal,
            "discount": discount_total,
            "tax": 0,
            "tax_status": "included",
            "shipping": 0,
            "shipping_status": "free",
            "total": total_amount,
        },
        "events": [
            {
                "at": now_utc(),
                "type": "manual_sale_created",
                "detail": f"Manual sale recorded by {user['email']}. Method: {input.payment_method}, Status: {input.payment_status}",
                "actor": user["email"],
            }
        ],
        "created_at": now_utc(),
    }

    await db.orders.insert_one(order_doc)
    await audit(user, "order.manual_create", "order", order_id, f"{order_number} ₹{total_amount//100} source={input.order_source}")
    return order_public(order_doc, include_private=True)


# ---------- Export & Cascading Locations ----------

@router.get("/admin/orders/export")
async def export_orders(
    status: Optional[str] = None,
    payment: Optional[str] = None,
    sales_source: Optional[str] = None,
    category: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    pincode: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_role("owner", "admin", "manager", "crm_master")),
):
    query = await _build_order_query(
        status=status, payment=payment, sales_source=sales_source,
        category=category, state=state, district=district, city=city,
        pincode=pincode, q=q, date_from=date_from, date_to=date_to,
    )

    docs = await db.orders.find(query).sort("created_at", -1).to_list(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order Number",
        "Sale Date",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Products",
        "Total Quantity",
        "Subtotal (INR)",
        "Discount (INR)",
        "Net Total (INR)",
        "Payment Method",
        "Payment Status",
        "Payment Provenance",
        "Sales Source",
        "Order Channel",
        "Employee ID",
        "Dealer ID",
        "Address",
        "City",
        "District",
        "State",
        "Pincode",
        "Fulfilment Status",
    ])

    for o in docs:
        addr = o.get("address") or {}
        items = o.get("items") or []
        items_desc = "; ".join(f"{it.get('product_name')} ({it.get('size')}) x{it.get('qty')}" for it in items)
        total_qty = sum(int(it.get("qty", 0)) for it in items)
        amounts = o.get("amounts") or {}

        sale_dt = o.get("sale_date") or o.get("created_at")
        sale_dt_str = sale_dt.strftime("%Y-%m-%d %H:%M:%S") if hasattr(sale_dt, "strftime") else str(sale_dt)

        writer.writerow([
            o.get("order_number"),
            sale_dt_str,
            addr.get("full_name") or o.get("email"),
            addr.get("phone") or "",
            o.get("email") or "",
            items_desc,
            total_qty,
            f"{int(amounts.get('subtotal', 0)) / 100:.2f}",
            f"{int(amounts.get('discount', 0)) / 100:.2f}",
            f"{int(amounts.get('total', 0)) / 100:.2f}",
            o.get("payment_method") or "online",
            o.get("payment_status"),
            o.get("payment_verification_source") or "PAYMENT_GATEWAY",
            o.get("order_source") or "DIRECT_WEBSITE",
            o.get("order_channel") or "WEBSITE",
            o.get("employee_id") or "",
            o.get("dealer_id") or "",
            f"{addr.get('line1', '')} {addr.get('line2', '')}".strip(),
            addr.get("city") or "",
            addr.get("district") or "",
            addr.get("state") or "",
            addr.get("pincode") or "",
            o.get("fulfilment_status"),
        ])

    output.seek(0)
    filename = f"kotson_orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/admin/locations/cascade")
async def locations_cascade(
    state: Optional[str] = None,
    district: Optional[str] = None,
    user=Depends(require_role("owner", "admin", "manager")),
):
    """Provides dynamic cascading location choices based on verified order data."""
    if not state or state == "ALL":
        states = await db.orders.distinct("address.state")
        return {"states": sorted([s for s in states if s and s.strip()]), "districts": [], "cities": []}

    match: dict = {"address.state": {"$regex": f"^{state.strip()}$", "$options": "i"}}
    if not district or district == "ALL":
        districts = await db.orders.distinct("address.district", match)
        return {
            "districts": sorted([d for d in districts if d and d.strip()]),
            "cities": [],
        }

    match["address.district"] = {"$regex": f"^{district.strip()}$", "$options": "i"}
    cities = await db.orders.distinct("address.city", match)
    pincodes = await db.orders.distinct("address.pincode", match)
    return {
        "cities": sorted([c for c in cities if c and c.strip()]),
        "pincodes": sorted([p for p in pincodes if p and p.strip()]),
    }


# ---------- Order Transitions & Refunds ----------

MANAGER_TRANSITIONS = {"processing", "shipped", "delivered"}
TRANSITIONS = {
    "awaiting_payment": {"cancelled"},
    "processing": {"ready_for_dispatch", "shipped", "delivered", "cancelled"},
    "ready_for_dispatch": {"shipped", "delivered", "cancelled"},
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
    if to not in {"processing", "ready_for_dispatch", "shipped", "delivered", "cancelled"}:
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
        {"$set": {"payment_status": "refunded"},
         "$push": {"events": {"at": utcnow(), "type": "refund_recorded", "detail": f"Refund of {input.amount} paise recorded ({refund['status']})", "actor": user["email"]}}},
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
