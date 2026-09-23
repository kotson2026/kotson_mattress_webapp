"""Claims & Trust Hub router: certifications, tested claims, lab evidence, and verification links."""

import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, optional_user, require_role
from lib.services import clean_doc
from models.claims import CertificationCreate, CertificationUpdate, ClaimCreate, ClaimUpdate

router = APIRouter()


# ---------------- Public Storefront Endpoints ----------------

@router.get("/content/certifications")
async def public_certifications():
    """Returns active, verified certifications for storefront display."""
    docs = await db.certifications.find({"is_visible": True, "status": "VERIFIED"}).sort("display_order", 1).to_list(50)
    return [clean_doc(d) for d in docs]


@router.get("/content/claims-verified")
async def public_claims():
    """Returns verified product claims for storefront trust badges and PDP sections."""
    docs = await db.claims_trust.find({"is_visible": True, "verification_status": "VERIFIED"}).sort("display_order", 1).to_list(50)
    return [clean_doc(d) for d in docs]


# ---------------- Admin Management Endpoints ----------------

@router.get("/admin/claims-trust/overview")
async def claims_trust_overview(user=Depends(require_role(OWNER, ADMIN))):
    """Overview metrics for Claims & Trust Hub."""
    total_certs = await db.certifications.count_documents({})
    verified_certs = await db.certifications.count_documents({"status": "VERIFIED"})
    pending_certs = await db.certifications.count_documents({"status": {"$in": ["PENDING_RENEWAL", "DRAFT"]}})

    total_claims = await db.claims_trust.count_documents({})
    verified_claims = await db.claims_trust.count_documents({"verification_status": "VERIFIED"})
    draft_claims = await db.claims_trust.count_documents({"verification_status": "DRAFT"})

    return {
        "total_certifications": total_certs,
        "verified_certifications": verified_certs,
        "pending_certifications": pending_certs,
        "total_claims": total_claims,
        "verified_claims": verified_claims,
        "draft_claims": draft_claims,
    }


# Certifications CRUD
@router.get("/admin/claims-trust/certifications")
async def list_certifications(
    status: Optional[str] = None,
    q: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if status and status != "ALL":
        query["status"] = status
    if q:
        query["$or"] = [
            {"title": {"$regex": q.strip(), "$options": "i"}},
            {"issuer": {"$regex": q.strip(), "$options": "i"}},
            {"cert_number": {"$regex": q.strip(), "$options": "i"}},
        ]
    docs = await db.certifications.find(query).sort("display_order", 1).to_list(100)
    return [clean_doc(d) for d in docs]


@router.post("/admin/claims-trust/certifications", status_code=201)
async def create_certification(input: CertificationCreate, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.certifications.insert_one(doc)
    await audit(user, "certification.create", "certification", doc["id"], f"Added {doc['title']} by {doc['issuer']}")
    return clean_doc(doc)


@router.put("/admin/claims-trust/certifications/{cid}")
async def update_certification(cid: str, input: CertificationUpdate, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.certifications.find_one({"id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Certification not found")
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if not patch:
        return clean_doc(existing)
    patch["updated_at"] = now_utc()
    await db.certifications.update_one({"id": cid}, {"$set": patch})
    await audit(user, "certification.update", "certification", cid, f"Updated {list(patch.keys())}")
    updated = await db.certifications.find_one({"id": cid})
    return clean_doc(updated)


@router.delete("/admin/claims-trust/certifications/{cid}")
async def delete_certification(cid: str, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.certifications.find_one({"id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Certification not found")
    await db.certifications.delete_one({"id": cid})
    await audit(user, "certification.delete", "certification", cid, f"Deleted {existing.get('title')}")
    return {"status": "success", "message": "Certification deleted successfully"}


# Tested Claims CRUD
@router.get("/admin/claims-trust/claims")
async def list_claims(
    category: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if category and category != "ALL":
        query["category"] = category
    if status and status != "ALL":
        query["verification_status"] = status
    if q:
        query["$or"] = [
            {"title": {"$regex": q.strip(), "$options": "i"}},
            {"metric_proof": {"$regex": q.strip(), "$options": "i"}},
        ]
    docs = await db.claims_trust.find(query).sort("display_order", 1).to_list(100)
    return [clean_doc(d) for d in docs]


@router.post("/admin/claims-trust/claims", status_code=201)
async def create_claim(input: ClaimCreate, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.claims_trust.insert_one(doc)
    await audit(user, "claim.create", "claims_trust", doc["id"], f"Added claim '{doc['title']}'")
    return clean_doc(doc)


@router.put("/admin/claims-trust/claims/{cid}")
async def update_claim(cid: str, input: ClaimUpdate, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.claims_trust.find_one({"id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Claim not found")
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if not patch:
        return clean_doc(existing)
    patch["updated_at"] = now_utc()
    await db.claims_trust.update_one({"id": cid}, {"$set": patch})
    await audit(user, "claim.update", "claims_trust", cid, f"Updated {list(patch.keys())}")
    updated = await db.claims_trust.find_one({"id": cid})
    return clean_doc(updated)


@router.post("/admin/claims-trust/claims/{cid}/verify")
async def toggle_claim_verify(cid: str, status: str = Query("VERIFIED"), user=Depends(require_role(OWNER, ADMIN))):
    if status not in ("VERIFIED", "DRAFT", "EXPIRED", "HIDDEN"):
        raise HTTPException(status_code=422, detail="Invalid verification status")
    existing = await db.claims_trust.find_one({"id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Claim not found")
    await db.claims_trust.update_one({"id": cid}, {"$set": {"verification_status": status, "updated_at": now_utc()}})
    await audit(user, "claim.verify", "claims_trust", cid, f"Set status to {status}")
    return {"status": "success", "verification_status": status}


@router.delete("/admin/claims-trust/claims/{cid}")
async def delete_claim(cid: str, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.claims_trust.find_one({"id": cid})
    if not existing:
        raise HTTPException(status_code=404, detail="Claim not found")
    await db.claims_trust.delete_one({"id": cid})
    await audit(user, "claim.delete", "claims_trust", cid, f"Deleted {existing.get('title')}")
    return {"status": "success", "message": "Claim deleted successfully"}
