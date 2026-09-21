"""Catalog: public browse + staff CRUD (soft deactivation only — never delete sold catalog)."""

import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.security import CATALOG_MANAGERS, FULFILMENT, audit, require_role
from lib.services import clean_doc
from models.catalog import (
    Category,
    InventoryAdjustIn,
    Product,
    ProductOut,
    ProductUpsertIn,
    VariantIn,
    VariantOut,
)
from models.users import utcnow

router = APIRouter()


def variant_public(v: dict) -> dict:
    d = clean_doc(v)
    d["free_stock"] = max(0, int(v.get("stock", 0)) - int(v.get("reserved", 0)))
    return d


async def product_with_variants(p: dict) -> ProductOut:
    variants = await db.variants.find({"product_id": p["id"], "is_active": True}).sort("price", 1).to_list(100)
    vp = [variant_public(v) for v in variants]
    price_from = min((v["price"] for v in vp), default=None)
    in_stock = any(v["free_stock"] > 0 for v in vp)
    return ProductOut(**{**clean_doc(p), "variants": vp, "price_from": price_from, "in_stock": in_stock})


@router.get("/catalog/categories", response_model=List[Category])
async def list_categories():
    docs = await db.categories.find({"is_active": True}).sort("sort", 1).to_list(100)
    return [Category(**clean_doc(d)) for d in docs]


@router.get("/catalog/products", response_model=List[ProductOut])
async def list_products(category: Optional[str] = None, q: Optional[str] = None, sort: str = "featured"):
    query: dict = {"is_active": True}
    if category:
        query["category_slug"] = category
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"tagline": rx}, {"description": rx}]
    order = [("sort", 1), ("created_at", -1)] if sort == "featured" else [("name", 1)]
    docs = await db.products.find(query).sort(order).to_list(200)
    return [await product_with_variants(d) for d in docs]


@router.get("/catalog/products/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    p = await db.products.find_one({"slug": slug, "is_active": True})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return await product_with_variants(p)


# ---------- staff: product CRUD (soft deactivation only) ----------

@router.get("/admin/products", response_model=List[ProductOut], dependencies=[])
async def admin_list_products(user=Depends(require_role("owner", "admin", "manager"))):
    docs = await db.products.find({}).sort("created_at", -1).to_list(500)
    out = []
    for d in docs:
        variants = await db.variants.find({"product_id": d["id"]}).to_list(200)
        vp = [variant_public(v) for v in variants]
        out.append(
            ProductOut(
                **{**clean_doc(d), "variants": vp, "price_from": min((v["price"] for v in vp), default=None),
                   "in_stock": any(v["free_stock"] > 0 for v in vp)}
            )
        )
    return out


@router.post("/admin/products", response_model=ProductOut)
async def admin_create_product(input: ProductUpsertIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    if await db.products.find_one({"slug": input.slug}):
        raise HTTPException(status_code=409, detail="A product with this slug already exists")
    cat = await db.categories.find_one({"slug": input.category_slug})
    if not cat:
        raise HTTPException(status_code=422, detail="Unknown category")
    doc = input.model_dump() | {"id": str(uuid.uuid4()), "images": [], "is_seed": False, "created_at": utcnow()}
    await db.products.insert_one(doc)
    await audit(user, "product.create", "product", doc["id"], input.slug)
    return await product_with_variants(doc)


@router.patch("/admin/products/{pid}", response_model=ProductOut)
async def admin_update_product(pid: str, input: ProductUpsertIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.products.find_one_and_update(
        {"id": pid}, {"$set": input.model_dump() | {"updated_at": utcnow()}}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    await audit(user, "product.update", "product", pid, input.slug)
    return await product_with_variants(doc)


@router.post("/admin/products/{pid}/deactivate")
async def admin_deactivate_product(pid: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.products.find_one_and_update({"id": pid}, {"$set": {"is_active": False}})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    await audit(user, "product.deactivate", "product", pid, doc.get("slug", ""))
    return {"ok": True, "note": "Product deactivated (never deleted if it has purchase history)"}


@router.post("/admin/products/{pid}/variants", response_model=VariantOut)
async def admin_create_variant(pid: str, input: VariantIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    if not await db.products.find_one({"id": pid}):
        raise HTTPException(status_code=404, detail="Product not found")
    if await db.variants.find_one({"sku": input.sku}):
        raise HTTPException(status_code=409, detail="SKU already exists")
    doc = input.model_dump() | {"id": str(uuid.uuid4()), "product_id": pid, "reserved": 0, "is_active": True}
    await db.variants.insert_one(doc)
    if input.stock > 0:
        await db.inventory_ledger.insert_one(
            {"id": str(uuid.uuid4()), "variant_id": doc["id"], "sku": input.sku, "delta": input.stock,
             "old_stock": 0, "new_stock": input.stock, "reason": "initial stock", "actor_id": user["id"],
             "created_at": utcnow()}
        )
    await audit(user, "variant.create", "variant", doc["id"], input.sku)
    return VariantOut(**variant_public(doc))


@router.patch("/admin/variants/{vid}", response_model=VariantOut)
async def admin_update_variant(vid: str, input: VariantIn, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.variants.find_one_and_update(
        {"id": vid},
        {"$set": {"sku": input.sku, "size": input.size, "thickness": input.thickness,
                  "firmness": input.firmness, "price": input.price, "mrp": input.mrp,
                  "is_active": True}},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Variant not found")
    await audit(user, "variant.update", "variant", vid, f"price={input.price}")
    return VariantOut(**variant_public(doc))


@router.post("/admin/inventory/adjust")
async def admin_inventory_adjust(input: InventoryAdjustIn, user=Depends(require_role(*FULFILMENT))):
    """Records old/new/actor/time/reason; never touches active reservations."""
    variant = await db.variants.find_one({"id": input.variant_id})
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    new_stock = max(0, int(variant["stock"]) + input.delta)
    actual_delta = new_stock - int(variant["stock"])
    await db.variants.update_one({"id": input.variant_id}, {"$set": {"stock": new_stock}})
    await db.inventory_ledger.insert_one(
        {"id": str(uuid.uuid4()), "variant_id": input.variant_id, "sku": variant["sku"],
         "delta": actual_delta, "old_stock": variant["stock"], "new_stock": new_stock,
         "reason": input.reason, "actor_id": user["id"], "actor_email": user["email"],
         "created_at": utcnow()}
    )
    await audit(user, "inventory.adjust", "variant", input.variant_id,
                f"{actual_delta:+d} ({variant['stock']} -> {new_stock}): {input.reason}")
    return {"ok": True, "old_stock": variant["stock"], "new_stock": new_stock}
