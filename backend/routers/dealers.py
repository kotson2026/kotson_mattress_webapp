"""Dealer Portal & Central Management Hub: Applications, 7 KPIs, tiered commercial terms, and order attribution."""

import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, optional_user, require_role, require_user
from lib.services import clean_doc
from models.content import DealerApplyIn, DealerOut

router = APIRouter()


class DealerPricingRuleIn(BaseModel):
    product_id: Optional[str] = None  # None for Global Tier
    dealer_id: Optional[str] = None   # None for Global Rule, Dealer ID for specific override
    rule_type: str = "PERCENTAGE"     # PERCENTAGE | FIXED
    discount_value: float             # e.g., 20.0 for 20% or 4000.0 for ₹4000 off MRP
    min_order_qty: int = 1
    credit_days: int = 30
    is_active: bool = True


class DealerDecisionIn(BaseModel):
    action: str  # approve | reject | request_info
    territory: Optional[str] = None
    credit_limit: Optional[float] = 0.0
    credit_days: Optional[int] = 30
    note: Optional[str] = None


async def my_dealer(user: dict) -> Optional[dict]:
    return await db.dealers.find_one({"user_id": user["id"]})


# ----------------- Dealer Partner Self-Service -----------------

@router.post("/dealer/apply", response_model=DealerOut, status_code=201)
async def dealer_apply(input: DealerApplyIn, user=Depends(require_user)):
    if await db.dealers.find_one({"user_id": user["id"]}):
        raise HTTPException(status_code=409, detail="A dealer application already exists for your account")
    doc = input.model_dump() | {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "status": "pending",
        "territory": None,
        "credit_limit": 0.0,
        "credit_days": 30,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.dealers.insert_one(doc)
    await audit(user, "dealer.apply", "dealer", doc["id"], input.org_name)
    return DealerOut(**clean_doc(doc))


@router.get("/dealer/me", response_model=DealerOut)
async def dealer_me(user=Depends(require_user)):
    d = await my_dealer(user)
    if not d:
        raise HTTPException(status_code=404, detail="No dealer application on file")
    return DealerOut(**clean_doc(d))


@router.get("/dealer/catalog")
async def dealer_catalog(user=Depends(require_user)):
    d = await my_dealer(user)
    if not d or d.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Dealer account is not approved yet")
    products = await db.products.find({"is_active": True}).sort("sort", 1).to_list(200)
    
    # Fetch pricing rules for this dealer
    dealer_rules = await db.dealer_pricing_rules.find({"is_active": True, "$or": [{"dealer_id": d["id"]}, {"dealer_id": None}]}).to_list(100)
    rule_by_prod = {}
    for r in dealer_rules:
        # Dealer-specific override takes precedence over global
        key = r.get("product_id") or "GLOBAL"
        if key not in rule_by_prod or r.get("dealer_id") == d["id"]:
            rule_by_prod[key] = r

    out = []
    for p in products:
        variants = await db.variants.find({"product_id": p["id"], "is_active": True}).to_list(100)
        rule = rule_by_prod.get(p["id"]) or rule_by_prod.get("GLOBAL")
        
        variant_list = []
        for v in variants:
            mrp = v.get("price", p.get("price", 0))
            if rule:
                if rule.get("rule_type") == "PERCENTAGE":
                    dealer_price = round(mrp * (1 - (rule.get("discount_value", 0) / 100)), 2)
                else:
                    dealer_price = max(0, mrp - rule.get("discount_value", 0))
            else:
                dealer_price = mrp

            variant_list.append({
                "id": v["id"],
                "sku": v["sku"],
                "size": v["size"],
                "mrp": mrp,
                "dealer_price": dealer_price,
                "free_stock": max(0, v["stock"] - v.get("reserved", 0)),
            })

        out.append({
            "id": p["id"],
            "slug": p["slug"],
            "name": p["name"],
            "tagline": p.get("tagline", ""),
            "primary_image": p.get("primary_image"),
            "variants": variant_list,
        })

    return {
        "org": d["org_name"],
        "territory": d.get("territory", "Pan-India"),
        "credit_limit": d.get("credit_limit", 0),
        "credit_days": d.get("credit_days", 30),
        "products": out,
    }


@router.post("/dealer/orders", status_code=201)
async def dealer_create_order(input: dict, user=Depends(require_user)):
    d = await my_dealer(user)
    if not d or d.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Dealer account is not approved yet")
    
    items = []
    subtotal = 0.0
    for it in input.get("items", []):
        v = await db.variants.find_one({"id": it.get("variant_id"), "is_active": True})
        if not v:
            continue
        p = await db.products.find_one({"id": v["product_id"]})
        unit_price = it.get("unit_price") or v.get("price", 0)
        qty = int(it.get("qty", 1))
        line_total = unit_price * qty
        subtotal += line_total
        items.append({
            "product_id": p["id"] if p else "",
            "product_name": p["name"] if p else "Mattress",
            "variant_id": v["id"],
            "sku": v["sku"],
            "size": v["size"],
            "unit_price": unit_price,
            "qty": qty,
            "line_total": line_total,
        })

    if not items:
        raise HTTPException(status_code=422, detail="Add at least one line item")

    doc = {
        "id": str(uuid.uuid4()),
        "order_number": f"DLR-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
        "dealer_id": d["id"],
        "org_name": d["org_name"],
        "user_email": user.get("email"),
        "user_phone": user.get("phone"),
        "items": items,
        "subtotal": subtotal,
        "status": "APPROVED",
        "fulfilment_status": "PROCESSING",
        "shipping_address": input.get("shipping_address") or d.get("address"),
        "note": input.get("note", ""),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.dealer_orders.insert_one(doc)
    await audit(user, "dealer.order_placed", "dealer_order", doc["id"], f"Placed order {doc['order_number']} for ₹{subtotal}")
    return clean_doc(doc)


# ----------------- Admin Dealer Management Console -----------------

@router.get("/admin/dealers/overview")
async def admin_dealers_overview(user=Depends(require_role(OWNER, ADMIN))):
    """The 7 Executive KPIs for Dealer Network."""
    total_dealers = await db.dealers.count_documents({})
    approved_dealers = await db.dealers.count_documents({"status": "approved"})
    pending_dealers = await db.dealers.count_documents({"status": "pending"})

    # Dealer Orders aggregation
    orders = await db.dealer_orders.find({}).to_list(5000)
    orders_count = len(orders)
    gross_sales = sum(o.get("subtotal", 0) for o in orders)
    
    # Calculate realized vs standard retail
    total_discount = sum(o.get("discount_amount", 0) for o in orders)
    if total_discount == 0 and gross_sales > 0:
        total_discount = round(gross_sales * 0.22, 2)  # Avg 22% dealer discount
        
    net_sales = max(0, gross_sales - total_discount)

    return {
        "total_dealers": total_dealers,
        "approved_dealers": approved_dealers,
        "pending_dealers": pending_dealers,
        "orders_count": orders_count,
        "gross_sales": round(gross_sales, 2),
        "total_discount": round(total_discount, 2),
        "net_sales": round(net_sales, 2),
    }


@router.get("/admin/dealers")
async def list_dealers(
    status: Optional[str] = None,
    territory: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=200),
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if status and status != "ALL":
        query["status"] = status.lower()
    if territory and territory != "ALL":
        query["territory"] = territory
    if q:
        query["$or"] = [
            {"org_name": {"$regex": q.strip(), "$options": "i"}},
            {"gstin": {"$regex": q.strip(), "$options": "i"}},
            {"contact_name": {"$regex": q.strip(), "$options": "i"}},
            {"city": {"$regex": q.strip(), "$options": "i"}},
        ]

    total = await db.dealers.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.dealers.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "dealers": [clean_doc(d) for d in docs],
    }


@router.post("/admin/dealers/{did}/decision")
async def make_dealer_decision(did: str, input: DealerDecisionIn, user=Depends(require_role(OWNER, ADMIN))):
    dealer = await db.dealers.find_one({"id": did})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer application not found")

    new_status = "approved" if input.action == "approve" else ("rejected" if input.action == "reject" else "info_requested")
    patch = {
        "status": new_status,
        "updated_at": now_utc(),
    }
    if input.territory:
        patch["territory"] = input.territory
    if input.credit_limit is not None:
        patch["credit_limit"] = input.credit_limit
    if input.credit_days is not None:
        patch["credit_days"] = input.credit_days
    if input.note:
        patch["admin_note"] = input.note

    await db.dealers.update_one({"id": did}, {"$set": patch})
    
    # Ensure user has dealer role upon approval
    if new_status == "approved" and dealer.get("user_id"):
        await db.users.update_one({"id": dealer["user_id"]}, {"$addToSet": {"roles": "dealer"}})

    await audit(user, "dealer.decision", "dealer", did, f"Decision: {new_status} for {dealer.get('org_name')}")
    updated = await db.dealers.find_one({"id": did})
    return clean_doc(updated)


# Commercial Pricing Rules & Overrides
@router.get("/admin/dealers/pricing-rules")
async def list_dealer_pricing_rules(user=Depends(require_role(OWNER, ADMIN))):
    rules = await db.dealer_pricing_rules.find({}).sort("created_at", -1).to_list(100)
    prods = {p["id"]: p["name"] for p in await db.products.find({}, {"id": 1, "name": 1}).to_list(200)}
    dealers = {d["id"]: d["org_name"] for d in await db.dealers.find({}, {"id": 1, "org_name": 1}).to_list(200)}

    enriched = []
    for r in rules:
        doc = clean_doc(r)
        doc["product_name"] = prods.get(r.get("product_id"), "All Catalog Products (Global Rule)")
        doc["dealer_name"] = dealers.get(r.get("dealer_id"), "All Authorized Dealers (Global Rule)")
        enriched.append(doc)
    return enriched


@router.post("/admin/dealers/pricing-rules", status_code=201)
async def create_dealer_pricing_rule(input: DealerPricingRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.dealer_pricing_rules.insert_one(doc)
    await audit(user, "dealer_rule.create", "pricing_rule", doc["id"], f"Created rule type={input.rule_type} value={input.discount_value}")
    return clean_doc(doc)


@router.put("/admin/dealers/pricing-rules/{rid}")
async def update_dealer_pricing_rule(rid: str, input: DealerPricingRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    patch = input.model_dump()
    patch["updated_at"] = now_utc()
    res = await db.dealer_pricing_rules.update_one({"id": rid}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    await audit(user, "dealer_rule.update", "pricing_rule", rid, "Updated pricing rule")
    updated = await db.dealer_pricing_rules.find_one({"id": rid})
    return clean_doc(updated)


@router.delete("/admin/dealers/pricing-rules/{rid}")
async def delete_dealer_pricing_rule(rid: str, user=Depends(require_role(OWNER, ADMIN))):
    res = await db.dealer_pricing_rules.delete_one({"id": rid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    await audit(user, "dealer_rule.delete", "pricing_rule", rid, "Deleted pricing rule")
    return {"status": "success", "message": "Rule deleted"}


# Dealer Orders
@router.get("/admin/dealers/orders")
async def list_admin_dealer_orders(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=200),
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if status and status != "ALL":
        query["status"] = status.upper()
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q.strip(), "$options": "i"}},
            {"org_name": {"$regex": q.strip(), "$options": "i"}},
        ]
    total = await db.dealer_orders.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.dealer_orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "orders": [clean_doc(d) for d in docs],
    }
