"""Dealer portal: application, approval, own org scope, quote-only pricing until terms are set."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.security import audit, now_utc, optional_user, require_role, require_user
from lib.services import clean_doc
from models.content import DealerApplyIn, DealerOut

router = APIRouter()


async def my_dealer(user: dict) -> Optional[dict]:
    return await db.dealers.find_one({"user_id": user["id"]})


@router.post("/dealer/apply", response_model=DealerOut, status_code=201)
async def dealer_apply(input: DealerApplyIn, user=Depends(require_user)):
    if await db.dealers.find_one({"user_id": user["id"]}):
        raise HTTPException(status_code=409, detail="A dealer application already exists for your account")
    doc = input.model_dump() | {
        "id": str(uuid.uuid4()), "user_id": user["id"], "status": "pending",
        "terms_status": "pending_configuration", "created_at": now_utc(),
    }
    await db.dealers.insert_one(doc)
    await audit(user, "dealer.apply", "dealer", doc["id"], input.org_name)
    return DealerOut(**doc)


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
    out = []
    for p in products:
        variants = await db.variants.find({"product_id": p["id"], "is_active": True}).to_list(100)
        out.append({
            "slug": p["slug"], "name": p["name"], "tagline": p.get("tagline", ""),
            "variants": [{"id": v["id"], "sku": v["sku"], "size": v["size"], "quote_only": True,
                          "free_stock": max(0, v["stock"] - v.get("reserved", 0))} for v in variants],
        })
    return {"org": d["org_name"], "terms_status": d.get("terms_status", "pending_configuration"),
            "note": "Dealer pricing, margins, credit and tax terms are pending owner configuration — every line is quote-only until published.",
            "products": out}


@router.post("/dealer/orders", status_code=201)
async def dealer_create_order(input: dict, user=Depends(require_user)):
    d = await my_dealer(user)
    if not d or d.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Dealer account is not approved yet")
    items = []
    for it in input.get("items", []):
        v = await db.variants.find_one({"id": it.get("variant_id"), "is_active": True})
        if not v:
            raise HTTPException(status_code=422, detail="Unknown variant in request")
        p = await db.products.find_one({"id": v["product_id"]})
        items.append({"variant_id": v["id"], "sku": v["sku"], "product_name": p["name"] if p else "",
                      "size": v["size"], "qty": int(it.get("qty", 1))})
    if not items:
        raise HTTPException(status_code=422, detail="Add at least one line to the quote request")
    doc = {
        "id": str(uuid.uuid4()), "dealer_id": d["id"], "org_name": d["org_name"], "items": items,
        "status": "quote_requested", "note": input.get("note", ""),
        "pricing_status": "pending_configuration", "created_at": now_utc(),
    }
    await db.dealer_orders.insert_one(doc)
    await audit(user, "dealer.order", "dealer_order", doc["id"], f"{d['org_name']} x{len(items)} lines")
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/dealer/orders")
async def dealer_my_orders(user=Depends(require_user)):
    d = await my_dealer(user)
    if not d:
        raise HTTPException(status_code=404, detail="No dealer application on file")
    docs = await db.dealer_orders.find({"dealer_id": d["id"]}).sort("created_at", -1).to_list(200)
    return [{k: v for k, v in doc.items() if k != "_id"} for doc in docs]


# ---------- owner/admin management ----------

@router.get("/admin/dealers", dependencies=[])
async def admin_dealers(user=Depends(require_role("owner", "admin"))):
    docs = await db.dealers.find({}).sort("created_at", -1).to_list(200)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/dealers/{did}")
async def admin_dealer_patch(did: str, input: dict, user=Depends(require_role("owner", "admin"))):
    status = input.get("status")
    patch = {k: input[k] for k in ("status", "territory", "terms_status") if k in input}
    if status and status not in ("pending", "approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be pending | approved | rejected")
    doc = await db.dealers.find_one_and_update({"id": did}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Dealer not found")
    if status == "approved":
        await db.users.update_one({"id": doc["user_id"]}, {"$addToSet": {"roles": "dealer"}})
    await audit(user, "dealer.update", "dealer", did, str(patch))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/admin/dealer-orders", dependencies=[])
async def admin_dealer_orders(user=Depends(require_role("owner", "admin"))):
    docs = await db.dealer_orders.find({}).sort("created_at", -1).to_list(300)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/dealer-orders/{doid}")
async def admin_dealer_order_patch(doid: str, input: dict, user=Depends(require_role("owner", "admin"))):
    status = input.get("status")
    if status not in ("quoted", "approved", "rejected", "fulfilled"):
        raise HTTPException(status_code=422, detail="status must be quoted | approved | rejected | fulfilled")
    doc = await db.dealer_orders.find_one_and_update(
        {"id": doid},
        {"$set": {"status": status, "pricing_status": "pending_configuration"},
         "$push": {"history": {"at": now_utc(), "status": status, "by": user["email"], "note": input.get("note", "")}}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Dealer order not found")
    await audit(user, "dealer.order_update", "dealer_order", doid, f"-> {status}")
    return {k: v for k, v in doc.items() if k != "_id"}
