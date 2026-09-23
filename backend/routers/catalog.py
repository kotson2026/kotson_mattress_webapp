"""Catalog router: public browse + full Owner/Admin Product & Category management.
Authoritative source of truth for products, variants, pricing, inventory, and storefront display.
"""

import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import (
    ADMIN,
    CATALOG_MANAGERS,
    FULFILMENT,
    MANAGER,
    OWNER,
    audit,
    now_utc,
    require_role,
)
from lib.services import clean_doc
from models.catalog import (
    Category,
    CategoryIn,
    InventoryAdjustIn,
    Product,
    ProductOut,
    ProductUpsertIn,
    Variant,
    VariantIn,
    VariantOut,
)
from models.users import utcnow

router = APIRouter()


def variant_public(v: dict) -> dict:
    d = clean_doc(v)
    stock = int(v.get("stock", 0))
    reserved = int(v.get("reserved", 0))
    price = int(v.get("price", 0))
    mrp = int(v.get("mrp", price)) if v.get("mrp") else price
    d["free_stock"] = max(0, stock - reserved)
    d["discount_amount"] = max(0, mrp - price)
    d["discount_percent"] = round(((mrp - price) / mrp) * 100, 1) if mrp > price else 0.0
    return d


async def product_with_variants(p: dict) -> ProductOut:
    variants = await db.variants.find({"product_id": p["id"]}).sort("price", 1).to_list(100)
    vp = [variant_public(v) for v in variants]
    price_from = min((v["price"] for v in vp), default=None)
    mrp_from = min((v.get("mrp") or v["price"] for v in vp), default=None)
    in_stock = any(v["free_stock"] > 0 for v in vp)
    total_stock = sum(v["free_stock"] for v in vp)

    return ProductOut(
        **{
            **clean_doc(p),
            "variants": vp,
            "price_from": price_from,
            "mrp_from": mrp_from,
            "in_stock": in_stock,
            "total_stock": total_stock,
        }
    )


# =============================================================================
# PUBLIC STOREFRONT BROWSING
# =============================================================================

@router.get("/catalog/categories", response_model=List[Category])
async def list_categories():
    docs = await db.categories.find({"is_active": True, "is_archived": {"$ne": True}}).sort("sort", 1).to_list(100)
    cats = []
    for d in docs:
        c_doc = clean_doc(d)
        cnt = await db.products.count_documents({
            "category_slug": d["slug"],
            "is_active": True,
            "status": {"$nin": ["PAUSED", "ARCHIVED", "paused", "archived"]},
            "website_visibility": {"$ne": "HIDDEN"},
        })
        c_doc["product_count"] = cnt
        cats.append(Category(**c_doc))
    return cats


@router.get("/catalog/products", response_model=List[ProductOut])
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = "featured",
):
    query: dict = {
        "is_active": True,
        "status": {"$nin": ["PAUSED", "ARCHIVED", "paused", "archived"]},
        "website_visibility": {"$ne": "HIDDEN"},
    }
    if category:
        query["category_slug"] = category
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"tagline": rx}, {"description": rx}, {"short_description": rx}]
    order = [("display_order", 1), ("sort", 1), ("created_at", -1)] if sort == "featured" else [("name", 1)]
    docs = await db.products.find(query).sort(order).to_list(200)
    return [await product_with_variants(d) for d in docs]


@router.get("/catalog/products/{slug}", response_model=ProductOut)
async def get_product(slug: str):
    p = await db.products.find_one({
        "slug": slug,
        "is_active": True,
        "status": {"$nin": ["PAUSED", "ARCHIVED", "paused", "archived"]},
        "website_visibility": {"$ne": "HIDDEN"},
    })
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return await product_with_variants(p)


# =============================================================================
# OWNER ADMIN — CATALOG DASHBOARD & PRODUCT CRUD
# =============================================================================

@router.get("/admin/catalog/overview")
async def admin_catalog_overview(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    """Top KPI metrics for the Catalog central overview."""
    total_products = await db.products.count_documents({"status": {"$ne": "ARCHIVED"}})
    active_products = await db.products.count_documents({
        "status": {"$ne": "ARCHIVED"},
        "$or": [{"status": "ACTIVE"}, {"status": None}, {"status": "active"}],
        "website_visibility": {"$ne": "HIDDEN"},
        "is_active": {"$ne": False},
    })
    paused_products = max(0, total_products - active_products)

    # Out of stock & low stock calculation across variants
    all_products = await db.products.find({"status": {"$ne": "ARCHIVED"}}).to_list(500)
    out_of_stock_count = 0
    low_stock_count = 0

    for p in all_products:
        variants = await db.variants.find({"product_id": p["id"]}).to_list(100)
        total_avail = sum(max(0, int(v.get("stock", 0)) - int(v.get("reserved", 0))) for v in variants)
        if total_avail == 0:
            out_of_stock_count += 1
        elif total_avail < 5:
            low_stock_count += 1

    return {
        "total_products": total_products,
        "active_products": active_products,
        "paused_products": paused_products,
        "out_of_stock": out_of_stock_count,
        "low_stock": low_stock_count,
    }


@router.get("/admin/catalog/products")
async def admin_catalog_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    stock_status: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN, MANAGER)),
):
    """Paginated, filterable high-density products table with real stock & pricing."""
    query: dict = {"status": {"$ne": "ARCHIVED"}}
    if category and category != "all":
        query["category_slug"] = category
    if status and status != "all":
        query["status"] = status
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": rx}, {"sku": rx}, {"category_slug": rx}, {"brand": rx}]

    all_matching = await db.products.find(query).sort("created_at", -1).to_list(1000)
    enriched = []

    for p in all_matching:
        p_out = await product_with_variants(p)
        # Apply stock filter if requested
        if stock_status == "OUT_OF_STOCK" and p_out.in_stock:
            continue
        if stock_status == "IN_STOCK" and not p_out.in_stock:
            continue
        if stock_status == "LOW_STOCK" and (p_out.total_stock >= 5 or p_out.total_stock == 0):
            continue
        # Apply price filter
        if price_min and (p_out.price_from or 0) < price_min:
            continue
        if price_max and (p_out.price_from or 0) > price_max:
            continue
        enriched.append(p_out.model_dump())

    total = len(enriched)
    total_pages = max(1, (total + limit - 1) // limit)
    skip = (page - 1) * limit
    paginated = enriched[skip : skip + limit]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "rows": paginated,
    }


# Backwards compatibility alias for existing admin calls
@router.get("/admin/products", response_model=List[ProductOut])
async def admin_list_products_legacy(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    docs = await db.products.find({"status": {"$ne": "ARCHIVED"}}).sort("created_at", -1).to_list(500)
    return [await product_with_variants(d) for d in docs]


@router.get("/admin/catalog/products/{pid}")
async def admin_get_product_detail(pid: str, user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return await product_with_variants(p)


@router.post("/admin/catalog/products", response_model=ProductOut)
async def admin_create_product(
    input: ProductUpsertIn, user=Depends(require_role(*CATALOG_MANAGERS))
):
    """Create a new product with full details, media, variants, and pricing rules."""
    slug = input.slug or re.sub(r"[^a-z0-9]+", "-", input.name.lower()).strip("-")
    if await db.products.find_one({"slug": slug}):
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    cat = await db.categories.find_one({"slug": input.category_slug})
    if not cat:
        # Create category on the fly if non-existent
        await db.categories.insert_one({
            "id": str(uuid.uuid4()),
            "slug": input.category_slug,
            "name": input.category_slug.replace("-", " ").title(),
            "description": f"{input.category_slug.replace('-', ' ').title()} category",
            "sort": 10,
            "is_active": True,
            "is_archived": False,
            "created_at": utcnow(),
        })

    pid = str(uuid.uuid4())
    p_data = input.model_dump(exclude={"variants"})
    p_doc = {
        **p_data,
        "id": pid,
        "slug": slug,
        "is_seed": False,
        "is_active": input.status != "PAUSED",
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    await db.products.insert_one(p_doc)

    # Insert variants
    if input.variants:
        for v in input.variants:
            vid = str(uuid.uuid4())
            mrp = v.mrp or v.price
            if mrp < v.price:
                mrp = v.price
            v_doc = {
                **v.model_dump(),
                "id": vid,
                "product_id": pid,
                "mrp": mrp,
                "reserved": 0,
                "is_active": True,
                "status": "ACTIVE",
            }
            await db.variants.insert_one(v_doc)
            if v.stock > 0:
                await db.inventory_ledger.insert_one({
                    "id": str(uuid.uuid4()),
                    "variant_id": vid,
                    "sku": v.sku,
                    "delta": v.stock,
                    "old_stock": 0,
                    "new_stock": v.stock,
                    "reason": "Initial product creation stock",
                    "actor_id": user["id"],
                    "actor_email": user["email"],
                    "created_at": utcnow(),
                })
    else:
        # Default standard variant
        default_sku = input.sku or f"{slug[:8].upper()}-STD"
        vid = str(uuid.uuid4())
        await db.variants.insert_one({
            "id": vid,
            "product_id": pid,
            "sku": default_sku,
            "size": "Standard (78 x 60 / 6 inch)",
            "thickness": "6 inch",
            "firmness": "Medium Firm",
            "price": 3200000,
            "mrp": 4000000,
            "stock": 10,
            "reserved": 0,
            "is_active": True,
            "status": "ACTIVE",
        })

    await audit(user, "catalog.product.create", "product", pid, f"Created {input.name} ({slug})")
    return await product_with_variants(p_doc)


@router.put("/admin/catalog/products/{pid}", response_model=ProductOut)
async def admin_update_product(
    pid: str, input: ProductUpsertIn, user=Depends(require_role(*CATALOG_MANAGERS))
):
    """Full update for product, store display, media, and variants."""
    existing = await db.products.find_one({"id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    p_data = input.model_dump(exclude={"variants"})
    p_data["is_active"] = input.status != "PAUSED"
    p_data["updated_at"] = utcnow()

    await db.products.update_one({"id": pid}, {"$set": p_data})

    # Update or insert variants if passed
    if input.variants is not None:
        for v in input.variants:
            mrp = v.mrp or v.price
            if mrp < v.price:
                mrp = v.price
            v_data = v.model_dump()
            v_data["mrp"] = mrp
            if v.id:
                await db.variants.update_one({"id": v.id, "product_id": pid}, {"$set": v_data})
            else:
                new_vid = str(uuid.uuid4())
                await db.variants.insert_one({
                    **v_data,
                    "id": new_vid,
                    "product_id": pid,
                    "reserved": 0,
                    "is_active": True,
                })

    await audit(user, "catalog.product.update", "product", pid, f"Updated {input.name}")
    updated = await db.products.find_one({"id": pid})
    return await product_with_variants(updated)


@router.post("/admin/catalog/products/{pid}/duplicate")
async def admin_duplicate_product(pid: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    """Duplicate an existing product and its variants safely."""
    orig = await db.products.find_one({"id": pid})
    if not orig:
        raise HTTPException(status_code=404, detail="Product not found")

    new_id = str(uuid.uuid4())
    new_slug = f"{orig['slug']}-copy-{uuid.uuid4().hex[:4]}"
    new_name = f"{orig['name']} (Copy)"

    dup_product = {
        **orig,
        "id": new_id,
        "name": new_name,
        "slug": new_slug,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    dup_product.pop("_id", None)
    await db.products.insert_one(dup_product)

    # Duplicate variants
    orig_variants = await db.variants.find({"product_id": pid}).to_list(100)
    for v in orig_variants:
        new_v = {
            **v,
            "id": str(uuid.uuid4()),
            "product_id": new_id,
            "sku": f"{v['sku']}-CPY",
            "reserved": 0,
        }
        new_v.pop("_id", None)
        await db.variants.insert_one(new_v)

    await audit(user, "catalog.product.duplicate", "product", new_id, f"Duplicated from {pid}")
    return await product_with_variants(dup_product)


class ProductStatusIn(BaseModel):
    status: Optional[str] = None  # ACTIVE, PAUSED, ARCHIVED
    website_visibility: Optional[str] = None  # VISIBLE, HIDDEN


@router.post("/admin/catalog/products/{pid}/status")
async def admin_set_product_status(
    pid: str, input: ProductStatusIn, user=Depends(require_role(*CATALOG_MANAGERS))
):
    """Pause, activate, hide, or archive product safely."""
    update: dict = {}
    if input.status:
        update["status"] = input.status
        update["is_active"] = input.status == "ACTIVE"
    if input.website_visibility:
        update["website_visibility"] = input.website_visibility

    res = await db.products.update_one({"id": pid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    await audit(user, "catalog.product.status", "product", pid, str(update))
    return {"ok": True, "updated": update}


@router.delete("/admin/catalog/products/{pid}")
async def admin_archive_product(pid: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    """Soft archive product to preserve historical orders."""
    res = await db.products.update_one(
        {"id": pid},
        {"$set": {"status": "ARCHIVED", "is_active": False, "website_visibility": "HIDDEN"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")

    await audit(user, "catalog.product.archive", "product", pid, "Soft archived product")
    return {"ok": True, "message": "Product archived safely without affecting order history"}


# =============================================================================
# CATEGORIES MANAGEMENT
# =============================================================================

@router.get("/admin/catalog/categories")
async def admin_list_categories(user=Depends(require_role(OWNER, ADMIN, MANAGER))):
    docs = await db.categories.find({"is_archived": {"$ne": True}}).sort("sort", 1).to_list(100)
    counts = {}
    for d in docs:
        c_count = await db.products.count_documents({"category_slug": d["slug"], "status": {"$ne": "ARCHIVED"}})
        counts[d["slug"]] = c_count

    rows = []
    for d in docs:
        item = clean_doc(d)
        item["product_count"] = counts.get(d["slug"], 0)
        rows.append(item)
    return {"rows": rows}


@router.post("/admin/catalog/categories")
async def admin_create_category(
    input: CategoryIn, user=Depends(require_role(*CATALOG_MANAGERS))
):
    slug = input.slug or re.sub(r"[^a-z0-9]+", "-", input.name.lower()).strip("-")
    if await db.categories.find_one({"slug": slug, "is_archived": {"$ne": True}}):
        raise HTTPException(status_code=409, detail="Category slug already exists")

    doc = {
        **input.model_dump(),
        "id": str(uuid.uuid4()),
        "slug": slug,
        "is_archived": False,
        "created_at": utcnow(),
    }
    await db.categories.insert_one(doc)
    await audit(user, "catalog.category.create", "category", doc["id"], input.name)
    return clean_doc(doc)


@router.put("/admin/catalog/categories/{cid}")
async def admin_update_category(
    cid: str, input: CategoryIn, user=Depends(require_role(*CATALOG_MANAGERS))
):
    data = input.model_dump(exclude_unset=True)
    res = await db.categories.update_one({"id": cid}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    await audit(user, "catalog.category.update", "category", cid, str(data))
    return clean_doc(await db.categories.find_one({"id": cid}))


@router.delete("/admin/catalog/categories/{cid}")
async def admin_archive_category(cid: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    res = await db.categories.update_one({"id": cid}, {"$set": {"is_archived": True, "is_active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    await audit(user, "catalog.category.archive", "category", cid, "Archived category")
    return {"ok": True, "message": "Category archived"}


# =============================================================================
# INVENTORY ADJUSTMENT
# =============================================================================

@router.post("/admin/inventory/adjust")
async def admin_inventory_adjust(input: InventoryAdjustIn, user=Depends(require_role(*FULFILMENT))):
    """Audited delta stock adjustment."""
    variant = await db.variants.find_one({"id": input.variant_id})
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    new_stock = max(0, int(variant["stock"]) + input.delta)
    actual_delta = new_stock - int(variant["stock"])
    await db.variants.update_one({"id": input.variant_id}, {"$set": {"stock": new_stock}})
    await db.inventory_ledger.insert_one({
        "id": str(uuid.uuid4()),
        "variant_id": input.variant_id,
        "sku": variant["sku"],
        "delta": actual_delta,
        "old_stock": variant["stock"],
        "new_stock": new_stock,
        "reason": input.reason,
        "actor_id": user["id"],
        "actor_email": user["email"],
        "created_at": utcnow(),
    })
    await audit(
        user,
        "inventory.adjust",
        "variant",
        input.variant_id,
        f"{actual_delta:+d} ({variant['stock']} -> {new_stock}): {input.reason}",
    )
    return {"ok": True, "old_stock": variant["stock"], "new_stock": new_stock}
