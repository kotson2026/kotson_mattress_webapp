"""Unified CRM call & disposition centre.

Save order enforced server-side:
  connectivity -> disposition (must belong to that connectivity) -> outcome (only when the
  disposition requires one) -> active engagement form answers -> optional summary -> optional
  separate follow-up -> save.

Invariants:
  * Saving a call NEVER changes the lead's CRM stage, nor any order/payment state.
  * Duplicate save/retry (same idempotency_key) creates neither a second call nor a second reminder.
  * Zero configured options is a legitimate empty production state — nothing is auto-seeded live.
  * No recording or duration is claimed: `verified_telephony` is always False (manual logging).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.security import CRM_EMPLOYEE, CRM_MANAGER, CRM_MASTER, OWNER, audit, now_utc, require_role
from lib.services import clean_doc
from models.crm import (
    Call,
    CallIn,
    CallOutcome,
    Connectivity,
    ConfigPatch,
    Disposition,
    EngagementForm,
    EngagementFormIn,
    FollowUp,
)

router = APIRouter()

CRM_ALL = (OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)
CRM_CONFIG = (OWNER, CRM_MASTER)

MISSING = object()


def _is_missing(value) -> bool:
    """`No`, `false` and numeric 0 are VALID answers. Only absent/null/whitespace/empty list is missing."""
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, tuple)) and len(value) == 0:
        return True
    return False


# ---------------------------------------------------------------- configuration centre

@router.get("/crm/dispositions/config")
async def call_config(active_only: bool = False, user=Depends(require_role(*CRM_ALL))):
    """Single configuration payload for the Connectivity / Dispositions / Outcomes / Form tabs."""
    q = {"is_active": True} if active_only else {}
    conns = await db.connectivities.find(q).sort("sort", 1).to_list(50)
    disps = await db.dispositions.find(q).sort("sort", 1).to_list(100)
    outs = await db.call_outcomes.find(q).sort("sort", 1).to_list(100)
    forms = await db.engagement_forms.find(q).sort("created_at", -1).to_list(50)
    # `configured` must reflect what an AGENT can actually use — active rows only, never drafts.
    active_conn = await db.connectivities.count_documents({"is_active": True})
    active_disp = await db.dispositions.count_documents({"is_active": True})
    return {
        "connectivities": [clean_doc(c) for c in conns],
        "dispositions": [clean_doc(d) for d in disps],
        "outcomes": [clean_doc(o) for o in outs],
        "forms": [clean_doc(f) for f in forms],
        "configured": bool(active_conn and active_disp),
        "active_counts": {"connectivities": active_conn, "dispositions": active_disp},
    }


@router.patch("/crm/dispositions/connectivities/{cid}")
async def patch_connectivity(cid: str, input: ConfigPatch, user=Depends(require_role(*CRM_CONFIG))):
    return await _patch_config("connectivities", cid, input, user)


@router.patch("/crm/dispositions/dispositions/{cid}")
async def patch_disposition(cid: str, input: ConfigPatch, user=Depends(require_role(*CRM_CONFIG))):
    return await _patch_config("dispositions", cid, input, user)


@router.patch("/crm/dispositions/outcomes/{cid}")
async def patch_outcome(cid: str, input: ConfigPatch, user=Depends(require_role(*CRM_CONFIG))):
    return await _patch_config("call_outcomes", cid, input, user)


async def _patch_config(coll: str, cid: str, input: ConfigPatch, user: dict):
    doc = await db[coll].find_one({"id": cid})
    if not doc:
        raise HTTPException(status_code=404, detail="Configuration row not found")
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=422, detail="Nothing to update")
    # Internal codes are immutable; only labels/activation/order change.
    await db[coll].update_one({"id": cid}, {"$set": patch})
    await audit(user, f"crm.config.{coll}", coll, cid, str(patch))
    return clean_doc(await db[coll].find_one({"id": cid}))


@router.post("/crm/dispositions/forms", response_model=EngagementForm, status_code=201)
async def create_form(input: EngagementFormIn, user=Depends(require_role(*CRM_CONFIG))):
    code = input.name.lower().replace(" ", "-")[:40]
    version = await db.engagement_forms.count_documents({"code": code}) + 1
    form = EngagementForm(code=code, version=version, **input.model_dump())
    await db.engagement_forms.insert_one(form.model_dump())
    await audit(user, "crm.form.create", "engagement_form", form.id, f"{form.name} v{version}")
    return form


@router.post("/crm/dispositions/forms/{fid}/activate", response_model=EngagementForm)
async def activate_form(fid: str, user=Depends(require_role(*CRM_CONFIG))):
    form = await db.engagement_forms.find_one({"id": fid})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    # Exactly one active version per form code.
    await db.engagement_forms.update_many({"code": form["code"]}, {"$set": {"is_active": False}})
    await db.engagement_forms.update_one({"id": fid}, {"$set": {"is_active": True}})
    await audit(user, "crm.form.activate", "engagement_form", fid, form["code"])
    return EngagementForm(**clean_doc(await db.engagement_forms.find_one({"id": fid})))


# ---------------------------------------------------------------- saving a call

@router.get("/crm/leads/{lid}/calls", response_model=List[Call])
async def lead_calls(lid: str, user=Depends(require_role(*CRM_ALL))):
    docs = await db.calls.find({"lead_id": lid}).sort("created_at", -1).to_list(200)
    return [Call(**clean_doc(d)) for d in docs]


@router.post("/crm/leads/{lid}/calls", response_model=Call, status_code=201)
async def save_call(lid: str, input: CallIn, user=Depends(require_role(*CRM_ALL))):
    from routers.crm_leads import assert_lead_access  # local import avoids a router cycle

    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await assert_lead_access(lead, user)

    # Idempotency: a retried save returns the original call, creating no duplicate reminder.
    if input.idempotency_key:
        prior = await db.calls.find_one({"lead_id": lid, "idempotency_key": input.idempotency_key})
        if prior:
            return Call(**clean_doc(prior))

    conn = await db.connectivities.find_one({"code": input.connectivity_code, "is_active": True})
    if not conn:
        raise HTTPException(status_code=422, detail="That connectivity option is not active")
    disp = await db.dispositions.find_one({"code": input.disposition_code, "is_active": True})
    if not disp:
        raise HTTPException(status_code=422, detail="That disposition is not active")
    # Backend enforces the pairing — e.g. Connected + Not Answering must fail.
    if disp["connectivity_code"] != conn["code"]:
        raise HTTPException(
            status_code=422,
            detail=f"'{disp['label']}' cannot be used with '{conn['label']}'",
        )

    outcome = None
    if disp.get("requires_outcome"):
        if not input.outcome_code:
            raise HTTPException(status_code=422, detail=f"'{disp['label']}' requires a call outcome")
        outcome = await db.call_outcomes.find_one({"code": input.outcome_code, "is_active": True})
        if not outcome:
            raise HTTPException(status_code=422, detail="That call outcome is not active")
    elif input.outcome_code:
        outcome = await db.call_outcomes.find_one({"code": input.outcome_code, "is_active": True})

    # Active engagement form is validated server-side against its stored field definitions.
    form = await db.engagement_forms.find_one({"is_active": True})
    snapshot: list = []
    answers: dict = {}
    if form:
        snapshot = form.get("fields", [])
        for f in snapshot:
            val = input.form_answers.get(f["code"], None)
            if f.get("required") and _is_missing(val):
                raise HTTPException(status_code=422, detail=f"'{f['label']}' is required")
            if not _is_missing(val):
                opts = f.get("options") or []
                if f["type"] in ("select", "radio") and opts and str(val) not in opts:
                    raise HTTPException(status_code=422, detail=f"'{f['label']}' has an invalid selection")
                if f["type"] == "multiselect":
                    vals = val if isinstance(val, list) else [val]
                    if opts and any(str(v) not in opts for v in vals):
                        raise HTTPException(status_code=422, detail=f"'{f['label']}' has an invalid selection")
                answers[f["code"]] = val
        if form.get("summary_field") == "required" and _is_missing(input.summary):
            raise HTTPException(status_code=422, detail="A discussion summary is required")

    call = Call(
        lead_id=lid,
        connectivity_code=conn["code"], connectivity_label=conn["label"],
        disposition_code=disp["code"], disposition_label=disp["label"],
        outcome_code=outcome["code"] if outcome else None,
        outcome_label=outcome["label"] if outcome else None,
        form_code=form["code"] if form else None,
        form_version=form["version"] if form else None,
        form_snapshot=snapshot, form_answers=answers,
        summary=input.summary,
        verified_telephony=False,  # manual log — never presented as provider-verified
        agent_id=user["id"], agent_email=user["email"],
        idempotency_key=input.idempotency_key,
    )
    await db.calls.insert_one(call.model_dump())

    # An optional follow-up is a SEPARATE record; it still does not touch the CRM stage.
    scheduled = None
    if input.follow_up_due_at:
        fu = FollowUp(
            lead_id=lid, due_at=input.follow_up_due_at,
            reason=input.follow_up_reason or f"Follow-up after {disp['label']}",
            owner_id=lead.get("employee_id") or user["id"], created_by=user["id"],
        )
        await db.follow_ups.insert_one(fu.model_dump())
        scheduled = fu.id

    # Touch only the activity timestamp — stage_code is deliberately untouched here.
    await db.leads.update_one({"id": lid}, {"$set": {"updated_at": now_utc()}})
    await audit(user, "crm.call.save", "lead", lid, f"{conn['label']}/{disp['label']}" + (f" +followup {scheduled}" if scheduled else ""))
    return call
