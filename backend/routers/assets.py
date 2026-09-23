"""Asset Library router: media manager with category grouping, metadata, and live Used-In protection."""

import re
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, require_role
from lib.services import clean_doc
from models.assets import AssetCreate, AssetOut, AssetUpdate

router = APIRouter()

CATEGORIES = [
    "Logos",
    "Homepage",
    "Navigation",
    "Product Media",
    "Banners",
    "Videos",
    "Certifications",
    "Trust",
    "Icons",
    "Dealer Assets",
    "Referral Assets",
    "Other",
]


async def find_asset_usage(asset_url: str, asset_id: str) -> List[dict]:
    """Find live references across products, categories, CMS sections, branding, and certifications."""
    usage = []
    if not asset_url:
        return usage

    # 1. Check Products
    prods = await db.products.find(
        {"$or": [{"primary_image": asset_url}, {"images": asset_url}]},
        {"id": 1, "name": 1, "slug": 1}
    ).to_list(20)
    for p in prods:
        usage.append({"type": "Product", "title": p.get("name", "Product"), "id": p.get("id"), "url": f"/products/{p.get('slug')}"})

    # 2. Check Categories
    cats = await db.categories.find(
        {"image_url": asset_url},
        {"id": 1, "name": 1, "slug": 1}
    ).to_list(10)
    for c in cats:
        usage.append({"type": "Category", "title": c.get("name", "Category"), "id": c.get("id"), "url": f"/collections/{c.get('slug')}"})

    # 3. Check CMS Pages / Sections
    pages = await db.cms_pages.find(
        {"sections.media_url": asset_url},
        {"id": 1, "title": 1, "slug": 1}
    ).to_list(10)
    for pg in pages:
        usage.append({"type": "CMS Page", "title": pg.get("title", "Page"), "id": pg.get("id"), "url": f"/{pg.get('slug')}"})

    # 4. Check CMS Branding
    branding = await db.cms_branding.find_one({
        "$or": [
            {"main_logo_url": asset_url},
            {"light_logo_url": asset_url},
            {"dark_logo_url": asset_url},
            {"favicon_url": asset_url},
            {"og_image_url": asset_url},
        ]
    })
    if branding:
        usage.append({"type": "Store Branding", "title": "Storefront Brand Logo / Favicon", "id": "branding", "url": "/"})

    # 5. Check Certifications
    certs = await db.certifications.find(
        {"$or": [{"badge_image_url": asset_url}, {"file_url": asset_url}]},
        {"id": 1, "title": 1}
    ).to_list(10)
    for crt in certs:
        usage.append({"type": "Certification", "title": crt.get("title", "Certificate"), "id": crt.get("id"), "url": "/claims-trust"})

    return usage


@router.get("/admin/assets/overview")
async def asset_overview(user=Depends(require_role(OWNER, ADMIN))):
    """Overview statistics for Asset Library."""
    total = await db.asset_library.count_documents({})
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}, "size_kb": {"$sum": {"$ifNull": ["$file_size_kb", 0]}}}},
    ]
    by_cat = await db.asset_library.aggregate(pipeline).to_list(50)
    cat_stats = {item["_id"] or "Other": {"count": item["count"], "size_kb": round(item["size_kb"], 1)} for item in by_cat}

    total_size_mb = round(sum(item["size_kb"] for item in by_cat) / 1024, 2)
    
    return {
        "total_assets": total,
        "total_size_mb": total_size_mb,
        "categories": CATEGORIES,
        "category_stats": cat_stats,
    }


@router.get("/admin/assets")
async def list_assets(
    category: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=200),
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if category and category != "ALL":
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": re.escape(q.strip()), "$options": "i"}},
            {"alt_text": {"$regex": re.escape(q.strip()), "$options": "i"}},
            {"tags": {"$in": [re.compile(re.escape(q.strip()), re.IGNORECASE)]}},
        ]

    total = await db.asset_library.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.asset_library.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "assets": [clean_doc(d) for d in docs],
    }


@router.post("/admin/assets", status_code=201)
async def create_asset(input: AssetCreate, user=Depends(require_role(OWNER, ADMIN))):
    doc = {
        "id": str(uuid.uuid4()),
        "title": input.title.strip(),
        "url": input.url.strip(),
        "category": input.category if input.category in CATEGORIES else "Other",
        "dimensions": input.dimensions or (f"{input.width}x{input.height}" if input.width and input.height else None),
        "width": input.width,
        "height": input.height,
        "file_size_kb": input.file_size_kb or 120.0,
        "file_type": input.file_type or "image/webp",
        "alt_text": input.alt_text or input.title,
        "tags": input.tags or [],
        "used_in_count": 0,
        "is_test_data": input.is_test_data,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.asset_library.insert_one(doc)
    await audit(user, "asset.create", "asset_library", doc["id"], f"Added asset {doc['title']} ({doc['category']})")
    return clean_doc(doc)


@router.get("/admin/assets/{aid}/usage")
async def get_asset_usage(aid: str, user=Depends(require_role(OWNER, ADMIN))):
    asset = await db.asset_library.find_one({"id": aid})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    usage = await find_asset_usage(asset.get("url", ""), aid)
    return {
        "asset_id": aid,
        "title": asset.get("title"),
        "url": asset.get("url"),
        "usage_count": len(usage),
        "used_in": usage,
    }


@router.put("/admin/assets/{aid}")
async def update_asset(aid: str, input: AssetUpdate, user=Depends(require_role(OWNER, ADMIN))):
    asset = await db.asset_library.find_one({"id": aid})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if not patch:
        return clean_doc(asset)
    patch["updated_at"] = now_utc()
    await db.asset_library.update_one({"id": aid}, {"$set": patch})
    await audit(user, "asset.update", "asset_library", aid, f"Updated {list(patch.keys())}")
    updated = await db.asset_library.find_one({"id": aid})
    return clean_doc(updated)


@router.delete("/admin/assets/{aid}")
async def delete_asset(aid: str, force: bool = False, user=Depends(require_role(OWNER, ADMIN))):
    asset = await db.asset_library.find_one({"id": aid})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Used-In safety check
    usage = await find_asset_usage(asset.get("url", ""), aid)
    if len(usage) > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Cannot delete '{asset.get('title')}': It is actively used in {len(usage)} place(s) on the live site.",
                "used_in": usage,
            }
        )

    await db.asset_library.delete_one({"id": aid})
    await audit(user, "asset.delete", "asset_library", aid, f"Deleted asset {asset.get('title')} (force={force})")
    return {"status": "success", "message": f"Asset '{asset.get('title')}' deleted successfully"}
