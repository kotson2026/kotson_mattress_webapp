"""CMS: published content blocks + claims + assets publicly; drafts/publish/rollback for staff."""

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.db import db
from lib.security import CATALOG_MANAGERS, audit, now_utc, require_role
from lib.services import clean_doc
from models.content import AssetUpdate, Claim, ClaimUpdate, CMSBlock, CMSBlockUpdate

router = APIRouter()


@router.get("/content/blocks")
async def public_blocks(page: str = "home"):
    docs = await db.blocks.find({"page": page, "status": "published"}).to_list(200)
    return {d["key"]: d["value"] for d in docs}


@router.get("/content/claims", response_model=List[Claim])
async def public_claims():
    docs = await db.claims.find({"status": "published"}).to_list(50)
    return [Claim(**clean_doc(d)) for d in docs]


@router.get("/content/claims/pending", response_model=List[Claim])
async def pending_claims():
    """Pending claims render as explicit 'owner verification pending' chips — never published copy."""
    docs = await db.claims.find({"status": {"$ne": "published"}}).to_list(50)
    return [Claim(**clean_doc(d)) for d in docs]


@router.get("/content/assets", response_model=List[dict])
async def public_assets():
    """All registry slots. Only `published` slots carry renderable media; `placeholder` slots let the
    storefront show a correctly-sized labelled placeholder until the owner uploads the real file."""
    docs = await db.assets.find({}).to_list(200)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.post("/contact")
async def contact(input: dict):
    name = (input.get("name") or "").strip()
    email = (input.get("email") or "").strip()
    subject = (input.get("subject") or "").strip()
    message = (input.get("message") or "").strip()
    if len(name) < 2 or "@" not in email or len(subject) < 3 or len(message) < 5:
        raise HTTPException(status_code=422, detail="Please fill in name, email, subject and message")
    await db.inquiries.insert_one(
        {"id": str(uuid.uuid4()), "customer_id": None, "name": name, "email": email,
         "phone": (input.get("phone") or "") or None, "subject": subject, "message": message,
         "issue_type": "general", "status": "open", "priority": "normal", "assignee_id": None,
         "notes": [], "created_at": now_utc()}
    )
    return {"ok": True}


@router.get("/seo/sitemap.xml", response_class=Response)
async def sitemap():
    base = os.environ.get("APP_URL", "https://kotsonmattress.com").rstrip("/")
    static = ["", "collections", "about", "faq", "contact", "track-order"]
    cats = await db.categories.find({"is_active": True}).to_list(50)
    prods = await db.products.find({"is_active": True}).to_list(500)
    urls = [f"{base}/{p}" for p in static] + [f"{base}/collections/{c['slug']}" for c in cats] + [f"{base}/products/{p['slug']}" for p in prods]
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    xml += "".join(f"<url><loc>{u}</loc></url>" for u in urls)
    xml += "</urlset>"
    return Response(content=xml, media_type="application/xml")


# ---------- staff CMS ----------

@router.get("/admin/cms/blocks", response_model=List[CMSBlock], dependencies=[])
async def admin_blocks(user=Depends(require_role(*CATALOG_MANAGERS))):
    docs = await db.blocks.find({}).sort([("page", 1), ("key", 1)]).to_list(300)
    return [CMSBlock(**clean_doc(d)) for d in docs]


@router.put("/admin/cms/blocks/{key}", response_model=CMSBlock)
async def admin_save_block(key: str, input: CMSBlockUpdate, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.blocks.find_one_and_update(
        {"key": key}, {"$set": {"value": input.value, "updated_at": now_utc()}}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown content block")
    await audit(user, "cms.save_draft", "block", key)
    return CMSBlock(**clean_doc(doc | {"value": input.value}))


@router.post("/admin/cms/blocks/{key}/publish", response_model=CMSBlock)
async def admin_publish_block(key: str, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.blocks.find_one({"key": key})
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown content block")
    revisions = doc.get("revisions", [])
    revisions.append({"value": doc.get("value", ""), "status": doc.get("status", "draft"), "at": now_utc(), "by": user["email"]})
    updated = await db.blocks.find_one_and_update(
        {"key": key},
        {"$set": {"status": "published", "published_value": doc.get("value", ""), "revisions": revisions[-20:],
                  "updated_at": now_utc()}},
        return_document=True,
    )
    await audit(user, "cms.publish", "block", key)
    return CMSBlock(**clean_doc(updated))


@router.post("/admin/cms/blocks/{key}/rollback", response_model=CMSBlock)
async def admin_rollback_block(key: str, revision_index: int, user=Depends(require_role(*CATALOG_MANAGERS))):
    doc = await db.blocks.find_one({"key": key})
    if not doc or revision_index >= len(doc.get("revisions", [])):
        raise HTTPException(status_code=404, detail="Revision not found")
    rev = doc["revisions"][revision_index]
    updated = await db.blocks.find_one_and_update(
        {"key": key},
        {"$set": {"value": rev["value"], "status": "published", "published_value": rev["value"],
                  "updated_at": now_utc()}},
        return_document=True,
    )
    await audit(user, "cms.rollback", "block", key, f"to revision {revision_index}")
    return CMSBlock(**clean_doc(updated))


@router.get("/admin/claims", response_model=List[Claim], dependencies=[])
async def admin_claims(user=Depends(require_role(*CATALOG_MANAGERS))):
    docs = await db.claims.find({}).sort("key", 1).to_list(50)
    return [Claim(**clean_doc(d)) for d in docs]


@router.patch("/admin/claims/{key}", response_model=Claim)
async def admin_update_claim(key: str, input: ClaimUpdate, user=Depends(require_role(*CATALOG_MANAGERS))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if patch.get("status") == "published" and patch.get("evidence_status", None) != "approved":
        existing = await db.claims.find_one({"key": key})
        if not existing or existing.get("evidence_status") != "approved":
            raise HTTPException(status_code=409, detail="Claims need owner-approved evidence before they can be published")
    doc = await db.claims.find_one_and_update({"key": key}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown claim")
    await audit(user, "claim.update", "claim", key, str(patch))
    return Claim(**clean_doc(doc))


@router.get("/admin/content/asset-slots", response_model=List[dict], dependencies=[])
async def admin_assets(user=Depends(require_role(*CATALOG_MANAGERS))):
    docs = await db.assets.find({}).sort("slot", 1).to_list(300)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/content/asset-slots/{slot}")
async def admin_update_asset(slot: str, input: AssetUpdate, user=Depends(require_role(*CATALOG_MANAGERS))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    doc = await db.assets.find_one_and_update({"slot": slot}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown asset slot")
    await audit(user, "asset.update", "asset", slot, str(patch))
    return {k: v for k, v in doc.items() if k != "_id"}
