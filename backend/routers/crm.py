"""CRM workspace: customer directory, customer 360, support inbox — strictly role-scoped."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from lib.crm_intake import capture_contact
from lib.db import db
from lib.security import (
    CRM_EMPLOYEE,
    CRM_MANAGER,
    CRM_MASTER,
    OWNER,
    audit,
    has_role,
    now_utc,
    require_role,
)
from lib.services import clean_doc
from models.content import CRMNoteIn, Inquiry, InquiryCreate, InquiryPatch

router = APIRouter()


def crm_scope(user: dict) -> str:
    if has_role(user, CRM_EMPLOYEE):
        return "assigned"
    if has_role(user, OWNER, CRM_MASTER, CRM_MANAGER):
        return "all"
    raise HTTPException(status_code=403, detail="Not a CRM role")


async def assigned_customer_ids(user_id: str) -> list[str]:
    rows = await db.inquiries.find({"assignee_id": user_id}).to_list(500)
    return list({r["customer_id"] for r in rows if r.get("customer_id")})


@router.get("/crm/customers")
async def crm_customers(q: Optional[str] = None, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE))):
    scope = crm_scope(user)
    query: dict = {"roles": "customer", "is_active": True}
    if scope == "assigned":
        query["id"] = {"$in": await assigned_customer_ids(user["id"])}
    if q:
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"name": rx}, {"email": rx}]
    docs = await db.users.find(query).sort("created_at", -1).to_list(300)
    out = []
    for d in docs:
        paid = await db.orders.find({"user_id": d["id"], "payment_status": "paid"}).sort("created_at", -1).to_list(100)
        out.append({
            "id": d["id"], "email": d["email"], "name": d["name"], "created_at": d["created_at"],
            "verified_purchases": len(paid),
            "lifetime_spend_paise": sum(o["amounts"]["total"] for o in paid),
            "last_order_at": paid[0]["created_at"] if paid else None,
        })
    return out


@router.get("/crm/customers/{cid}")
async def crm_customer_detail(cid: str, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE))):
    scope = crm_scope(user)
    if scope == "assigned" and cid not in await assigned_customer_ids(user["id"]):
        raise HTTPException(status_code=403, detail="This customer is not assigned to you")
    u = await db.users.find_one({"id": cid, "roles": "customer"})
    if not u:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders = await db.orders.find({"user_id": cid}).sort("created_at", -1).to_list(100)
    notes = await db.crm_notes.find({"customer_id": cid}).sort("created_at", -1).to_list(100)
    return {
        "customer": {"id": u["id"], "email": u["email"], "name": u["name"], "referral_code": u.get("referral_code"),
                     "referred_by": u.get("referred_by"), "created_at": u["created_at"]},
        "orders": [{"order_number": o["order_number"], "payment_status": o["payment_status"],
                    "fulfilment_status": o["fulfilment_status"], "total": o["amounts"]["total"],
                    "created_at": o["created_at"], "items": o["items"]} for o in orders],
        "notes": [{k: v for k, v in n.items() if k != "_id"} for n in notes],
    }


@router.post("/crm/customers/{cid}/notes")
async def crm_add_note(cid: str, input: CRMNoteIn, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE))):
    scope = crm_scope(user)
    if scope == "assigned" and cid not in await assigned_customer_ids(user["id"]):
        raise HTTPException(status_code=403, detail="This customer is not assigned to you")
    if not await db.users.find_one({"id": cid, "roles": "customer"}):
        raise HTTPException(status_code=404, detail="Customer not found")
    note = {"id": str(__import__("uuid").uuid4()), "customer_id": cid, "body": input.body,
            "author_id": user["id"], "author_email": user["email"], "created_at": now_utc()}
    await db.crm_notes.insert_one(note)
    await audit(user, "crm.note", "customer", cid)
    return {k: v for k, v in note.items() if k != "_id"}


@router.get("/crm/inquiries", response_model=List[Inquiry])
async def crm_inquiries(status: Optional[str] = None, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE))):
    scope = crm_scope(user)
    query: dict = {}
    if scope == "assigned":
        query["assignee_id"] = user["id"]
    if status:
        query["status"] = status
    docs = await db.inquiries.find(query).sort("created_at", -1).to_list(300)
    return [Inquiry(**clean_doc(d)) for d in docs]


@router.post("/crm/inquiries", response_model=Inquiry, status_code=201)
async def public_inquiry(input: InquiryCreate):
    doc = input.model_dump() | {"id": str(__import__("uuid").uuid4()), "customer_id": None,
                                "status": "open", "priority": "normal", "assignee_id": None,
                                "notes": [], "created_at": now_utc()}
    await db.inquiries.insert_one(doc)
    # CRM intake: a contact enquiry is a properly sourced, callable lead.
    try:
        await capture_contact("contact", input.name, str(input.email), input.phone, input.subject, doc["id"])
    except Exception:
        pass
    return Inquiry(**doc)


@router.patch("/crm/inquiries/{iid}", response_model=Inquiry)
async def crm_patch_inquiry(iid: str, input: InquiryPatch, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE))):
    scope = crm_scope(user)
    doc = await db.inquiries.find_one({"id": iid})
    if not doc:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    if scope == "assigned" and doc.get("assignee_id") != user["id"]:
        raise HTTPException(status_code=403, detail="This inquiry is not assigned to you")
    patch = {k: v for k, v in input.model_dump().items() if v is not None and k != "note"}
    events = []
    if patch:
        await db.inquiries.update_one({"id": iid}, {"$set": patch})
        events.append(f"updated {', '.join(patch)}")
    if input.note:
        await db.inquiries.update_one(
            {"id": iid},
            {"$push": {"notes": {"at": now_utc(), "author_id": user["id"], "author_email": user["email"], "body": input.note}}},
        )
        events.append("note added")
    await audit(user, "crm.inquiry", "inquiry", iid, "; ".join(events))
    updated = await db.inquiries.find_one({"id": iid})
    return Inquiry(**clean_doc(updated))
