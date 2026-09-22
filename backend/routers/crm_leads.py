"""CRM leads, pipelines, campaigns, assignments, follow-ups, service cases and reports.

Scope rules: CRM Master sees all CRM rows; Manager sees its team/pipelines; Employee sees only
assigned rows. Row-level scope is applied to lists, details, aggregates AND exports.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.crm_intake import _next_number, find_existing_lead, norm_email, norm_phone
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
from models.crm import (
    AssignIn,
    Campaign,
    CampaignIn,
    FollowUp,
    FollowUpCompleteIn,
    FollowUpIn,
    Lead,
    LeadManualIn,
    Pipeline,
    PipelineIn,
    ServiceCase,
    ServiceCaseIn,
    ServiceCasePatch,
    StageChangeIn,
)

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))
CRM_ALL = (OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)
CRM_CONFIG = (OWNER, CRM_MASTER)


# ---------------------------------------------------------------- scope

async def lead_scope_query(user: dict) -> dict:
    """The single source of row-level truth for every lead read."""
    if has_role(user, OWNER, CRM_MASTER):
        return {}
    if has_role(user, CRM_MANAGER):
        return {"$or": [{"manager_id": user["id"]}, {"employee_id": {"$in": await team_employee_ids(user["id"])}}]}
    return {"employee_id": user["id"]}  # employee


async def team_employee_ids(manager_id: str) -> List[str]:
    rows = await db.users.find({"roles": "crm_employee", "crm_manager_id": manager_id}).to_list(200)
    return [r["id"] for r in rows]


async def assert_lead_access(lead: dict, user: dict) -> None:
    scope = await lead_scope_query(user)
    if not scope:
        return
    if has_role(user, CRM_MANAGER):
        allowed = lead.get("manager_id") == user["id"] or lead.get("employee_id") in await team_employee_ids(user["id"])
    else:
        allowed = lead.get("employee_id") == user["id"]
    if not allowed:
        raise HTTPException(status_code=403, detail="This lead is not in your scope")


# ---------------------------------------------------------------- pipelines & campaigns

@router.get("/crm/pipelines", response_model=List[Pipeline])
async def list_pipelines(user=Depends(require_role(*CRM_ALL))):
    docs = await db.pipelines.find({}).sort("created_at", 1).to_list(100)
    return [Pipeline(**clean_doc(d)) for d in docs]


@router.post("/crm/pipelines", response_model=Pipeline, status_code=201)
async def create_pipeline(input: PipelineIn, user=Depends(require_role(*CRM_CONFIG))):
    code = input.name.lower().replace(" ", "-")[:40]
    if await db.pipelines.find_one({"code": code}):
        raise HTTPException(status_code=409, detail="A pipeline with this name already exists")
    p = Pipeline(code=code, **input.model_dump())
    await db.pipelines.insert_one(p.model_dump())
    await audit(user, "crm.pipeline.create", "pipeline", p.id, p.name)
    return p


@router.get("/crm/campaigns", response_model=List[Campaign])
async def list_campaigns(user=Depends(require_role(*CRM_ALL))):
    docs = await db.campaigns.find({}).sort("created_at", -1).to_list(200)
    return [Campaign(**clean_doc(d)) for d in docs]


@router.post("/crm/campaigns", response_model=Campaign, status_code=201)
async def create_campaign(input: CampaignIn, user=Depends(require_role(*CRM_CONFIG))):
    code = input.code.strip().lower()
    if await db.campaigns.find_one({"code": code}):
        raise HTTPException(status_code=409, detail="This campaign code is already used")
    c = Campaign(**(input.model_dump() | {"code": code}))
    await db.campaigns.insert_one(c.model_dump())
    await audit(user, "crm.campaign.create", "campaign", c.id, c.name)
    return c


# ---------------------------------------------------------------- leads

@router.get("/crm/leads")
async def list_leads(
    q: Optional[str] = None,
    kind: Optional[str] = None,
    qualification: Optional[str] = None,
    stage: Optional[str] = None,
    pipeline_id: Optional[str] = None,
    campaign_code: Optional[str] = None,
    employee_id: Optional[str] = None,
    manager_id: Optional[str] = None,
    open_only: bool = False,
    limit: int = Query(50, le=200),
    offset: int = 0,
    user=Depends(require_role(*CRM_ALL)),
):
    """Server-side search/filter/sort/paginate — never a table-wide client load."""
    query: dict = await lead_scope_query(user)
    if kind:
        query["kind"] = kind
    if qualification:
        query["qualification"] = qualification
    if stage:
        query["stage_code"] = stage
    if pipeline_id:
        query["pipeline_id"] = pipeline_id
    if campaign_code:
        query["campaign_code"] = campaign_code
    if employee_id:
        query["employee_id"] = employee_id
    if manager_id:
        query["manager_id"] = manager_id
    if open_only:
        query["is_open"] = True
    if q:
        s = q.strip()
        rx = {"$regex": s, "$options": "i"}
        ors: list = [{"name": rx}, {"email": rx}, {"lead_number": rx}, {"product_interest": rx}]
        ph = norm_phone(s)
        if ph:
            ors.append({"phone": ph})
        query = {"$and": [query, {"$or": ors}]} if query else {"$or": ors}
    total = await db.leads.count_documents(query)
    docs = await db.leads.find(query).sort("updated_at", -1).skip(offset).limit(limit).to_list(limit)
    return {"total": total, "limit": limit, "offset": offset, "rows": [clean_doc(d) for d in docs]}


@router.post("/crm/leads", response_model=Lead, status_code=201)
async def create_manual_lead(input: LeadManualIn, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER))):
    email, phone = norm_email(input.email), norm_phone(input.phone)
    if not email and not phone:
        raise HTTPException(status_code=422, detail="An email or phone number is required to create a callable lead")
    dupe = await find_existing_lead(None, email, phone)
    if dupe:
        raise HTTPException(status_code=409, detail=f"An open lead already exists for this contact ({dupe['lead_number']})")
    lead = Lead(
        lead_number=await _next_number("lead_number", "L"),
        kind="sales",
        name=input.name.strip(),
        email=email,
        phone=phone,
        pipeline_id=input.pipeline_id,
        campaign_code=input.campaign_code,
        product_interest=input.product_interest,
        qualification="sales_qualified",
        source_kind="manual",
        master_id=user["id"] if has_role(user, CRM_MASTER) else None,
    )
    doc = lead.model_dump()
    await db.leads.insert_one(doc)
    if input.note:
        await db.crm_notes.insert_one({
            "id": str(uuid.uuid4()), "lead_id": lead.id, "customer_id": None, "body": input.note,
            "author_id": user["id"], "author_email": user["email"], "created_at": now_utc(),
        })
    await audit(user, "crm.lead.create", "lead", lead.id, lead.lead_number)
    return lead


@router.get("/crm/leads/{lid}")
async def lead_workspace(lid: str, user=Depends(require_role(*CRM_ALL))):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await assert_lead_access(lead, user)
    events = await db.source_events.find({"id": {"$in": lead.get("source_event_ids", [])}}).to_list(100)
    calls = await db.calls.find({"lead_id": lid}).sort("created_at", -1).to_list(100)
    fus = await db.follow_ups.find({"lead_id": lid}).sort("due_at", 1).to_list(100)
    notes = await db.crm_notes.find({"lead_id": lid}).sort("created_at", -1).to_list(100)
    cases = await db.service_cases.find({"customer_id": lead.get("customer_id")}).to_list(50) if lead.get("customer_id") else []
    # Canonical commerce context is READ-ONLY here — CRM never owns order truth.
    orders: list = []
    if lead.get("customer_id"):
        raw = await db.orders.find({"user_id": lead["customer_id"]}).sort("created_at", -1).to_list(50)
        orders = [{
            "order_number": o["order_number"], "payment_status": o["payment_status"],
            "fulfilment_status": o["fulfilment_status"], "total": o["amounts"]["total"],
            "created_at": o["created_at"],
        } for o in raw]
    return {
        "lead": clean_doc(lead),
        "source_events": [clean_doc(e) for e in events],
        "calls": [clean_doc(c) for c in calls],
        "follow_ups": [clean_doc(f) for f in fus],
        "notes": [clean_doc(n) for n in notes],
        "cases": [clean_doc(c) for c in cases],
        "orders": orders,
    }


@router.post("/crm/leads/{lid}/stage", response_model=Lead)
async def change_stage(lid: str, input: StageChangeIn, user=Depends(require_role(*CRM_ALL))):
    """The ONLY manual path for a stage change. Saving a call or completing a follow-up never does this."""
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await assert_lead_access(lead, user)
    if lead.get("converted_order_id"):
        raise HTTPException(status_code=409, detail="This lead converted on a paid order — its stage is locked")
    if lead["stage_code"] == input.stage_code:
        raise HTTPException(status_code=409, detail="The lead is already at this stage")
    if lead.get("pipeline_id"):
        p = await db.pipelines.find_one({"id": lead["pipeline_id"]})
        codes = [s["code"] for s in (p or {}).get("stages", [])]
        if codes and input.stage_code not in codes:
            raise HTTPException(status_code=422, detail="That stage does not belong to this lead's pipeline")
    await db.leads.update_one(
        {"id": lid},
        {
            "$set": {"stage_code": input.stage_code, "updated_at": now_utc()},
            "$push": {"stage_history": {
                "at": now_utc(), "from": lead["stage_code"], "to": input.stage_code,
                "actor": user["email"], "actor_role": (user.get("roles") or [None])[0], "reason": input.reason,
            }},
        },
    )
    await audit(user, "crm.lead.stage", "lead", lid, f"{lead['stage_code']} -> {input.stage_code}: {input.reason}")
    return Lead(**clean_doc(await db.leads.find_one({"id": lid})))


@router.post("/crm/leads/assign")
async def assign_leads(input: AssignIn, user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER))):
    """Bulk assignment. Retries are safe: assigning the same owner twice records no duplicate work."""
    if not input.manager_id and not input.employee_id:
        raise HTTPException(status_code=422, detail="Choose a manager or an employee to assign to")
    for uid, role in ((input.manager_id, "crm_manager"), (input.employee_id, "crm_employee")):
        if uid:
            target = await db.users.find_one({"id": uid, "is_active": True})
            if not target or role not in (target.get("roles") or []):
                raise HTTPException(status_code=422, detail=f"Assignee is not an active {role}")
    assigned = 0
    for lid in input.lead_ids:
        lead = await db.leads.find_one({"id": lid})
        if not lead:
            continue
        if has_role(user, CRM_MANAGER) and not has_role(user, OWNER, CRM_MASTER):
            if lead.get("manager_id") != user["id"]:
                continue  # a manager may only reassign inside its own scope
        patch: dict = {"updated_at": now_utc()}
        if input.manager_id:
            patch["manager_id"] = input.manager_id
        if input.employee_id:
            patch["employee_id"] = input.employee_id
        if all(lead.get(k) == v for k, v in patch.items() if k != "updated_at"):
            continue  # already assigned — no duplicate history entry
        await db.leads.update_one(
            {"id": lid},
            {"$set": patch, "$push": {"assignment_history": {
                "at": now_utc(), "actor": user["email"],
                "prev_manager_id": lead.get("manager_id"), "prev_employee_id": lead.get("employee_id"),
                "master_id": lead.get("master_id"),
                "manager_id": patch.get("manager_id", lead.get("manager_id")),
                "employee_id": patch.get("employee_id", lead.get("employee_id")),
                "reason": input.reason,
            }}},
        )
        assigned += 1
    await audit(user, "crm.lead.assign", "lead", ",".join(input.lead_ids[:5]), f"{assigned} lead(s): {input.reason}")
    return {"ok": True, "assigned": assigned}


@router.get("/crm/intake-queue")
async def intake_queue(user=Depends(require_role(OWNER, CRM_MASTER))):
    """Owner intake queue: leads captured from signup/cart/contact not yet allocated to an employee."""
    rows = await db.leads.find({"employee_id": None, "is_open": True}).sort("created_at", -1).to_list(200)
    return {"total": len(rows), "rows": [clean_doc(r) for r in rows]}


# ---------------------------------------------------------------- follow-ups

@router.get("/crm/follow-ups")
async def list_follow_ups(
    bucket: str = Query("due_today", pattern="^(due_today|overdue|upcoming|completed)$"),
    user=Depends(require_role(*CRM_ALL)),
):
    """Buckets are computed against IST calendar days, then converted to UTC query bounds."""
    now = now_utc()
    ist_now = now.astimezone(IST)
    day_start_ist = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = day_start_ist.astimezone(timezone.utc)
    end_utc = (day_start_ist + timedelta(days=1)).astimezone(timezone.utc)

    q: dict = {}
    if bucket == "due_today":
        q = {"status": "pending", "due_at": {"$gte": start_utc, "$lt": end_utc}}
    elif bucket == "overdue":
        q = {"status": "pending", "due_at": {"$lt": start_utc}}
    elif bucket == "upcoming":
        q = {"status": "pending", "due_at": {"$gte": end_utc}}
    else:
        q = {"status": "completed"}

    if not has_role(user, OWNER, CRM_MASTER):
        ids = [user["id"]] + (await team_employee_ids(user["id"]) if has_role(user, CRM_MANAGER) else [])
        q["owner_id"] = {"$in": ids}

    rows = await db.follow_ups.find(q).sort("due_at", 1).to_list(200)
    out = []
    for r in rows:
        lead = await db.leads.find_one({"id": r["lead_id"]}, {"name": 1, "lead_number": 1, "phone": 1, "email": 1, "stage_code": 1})
        last_call = await db.calls.find_one({"lead_id": r["lead_id"]}, sort=[("created_at", -1)])
        out.append(clean_doc(r) | {
            "lead": clean_doc(lead) if lead else None,
            "due_at_ist": r["due_at"].replace(tzinfo=timezone.utc).astimezone(IST).strftime("%d %b %Y, %I:%M %p IST"),
            "last_call_at": last_call["created_at"] if last_call else None,
        })
    return {"bucket": bucket, "total": len(out), "rows": out}


@router.post("/crm/leads/{lid}/follow-ups", response_model=FollowUp, status_code=201)
async def schedule_follow_up(lid: str, input: FollowUpIn, user=Depends(require_role(*CRM_ALL))):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await assert_lead_access(lead, user)
    fu = FollowUp(
        lead_id=lid, due_at=input.due_at, reason=input.reason,
        owner_id=input.owner_id or lead.get("employee_id") or user["id"], created_by=user["id"],
    )
    await db.follow_ups.insert_one(fu.model_dump())
    await audit(user, "crm.followup.create", "lead", lid, input.reason)
    return fu


@router.post("/crm/follow-ups/{fid}/complete", response_model=FollowUp)
async def complete_follow_up(fid: str, input: FollowUpCompleteIn, user=Depends(require_role(*CRM_ALL))):
    """Completing a follow-up NEVER changes the lead's CRM stage."""
    fu = await db.follow_ups.find_one({"id": fid})
    if not fu:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    lead = await db.leads.find_one({"id": fu["lead_id"]})
    if lead:
        await assert_lead_access(lead, user)
    if fu["status"] != "pending":
        raise HTTPException(status_code=409, detail="This follow-up is already closed")
    await db.follow_ups.update_one(
        {"id": fid, "status": "pending"},
        {"$set": {"status": "completed", "completed_at": now_utc(), "completion_note": input.note}},
    )
    await audit(user, "crm.followup.complete", "follow_up", fid, "")
    return FollowUp(**clean_doc(await db.follow_ups.find_one({"id": fid})))


# ---------------------------------------------------------------- service cases

@router.get("/crm/cases", response_model=List[ServiceCase])
async def list_cases(status: Optional[str] = None, user=Depends(require_role(*CRM_ALL))):
    q: dict = {}
    if status:
        q["status"] = status
    if has_role(user, CRM_EMPLOYEE) and not has_role(user, OWNER, CRM_MASTER, CRM_MANAGER):
        q["assignee_id"] = user["id"]
    docs = await db.service_cases.find(q).sort("created_at", -1).to_list(200)
    return [ServiceCase(**clean_doc(d)) for d in docs]


@router.post("/crm/cases", response_model=ServiceCase, status_code=201)
async def create_case(input: ServiceCaseIn, user=Depends(require_role(*CRM_ALL))):
    order_number = None
    if input.order_id:
        o = await db.orders.find_one({"id": input.order_id})
        if not o:
            raise HTTPException(status_code=404, detail="Order not found")
        order_number = o["order_number"]
    case = ServiceCase(
        case_number=await _next_number("case_number", "SC"),
        order_number=order_number,
        assignee_id=user["id"],
        **input.model_dump(),
    )
    await db.service_cases.insert_one(case.model_dump())
    await audit(user, "crm.case.create", "case", case.id, case.subject)
    return case


@router.patch("/crm/cases/{cid}", response_model=ServiceCase)
async def patch_case(cid: str, input: ServiceCasePatch, user=Depends(require_role(*CRM_ALL))):
    """Case status never changes payment, fulfilment or refund state — those stay in commerce."""
    case = await db.service_cases.find_one({"id": cid})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if has_role(user, CRM_EMPLOYEE) and not has_role(user, OWNER, CRM_MASTER, CRM_MANAGER):
        if case.get("assignee_id") != user["id"]:
            raise HTTPException(status_code=403, detail="This case is not assigned to you")
    patch = {k: v for k, v in input.model_dump().items() if v is not None and k != "note"}
    if patch:
        await db.service_cases.update_one({"id": cid}, {"$set": patch})
    trail = {"at": now_utc(), "actor": user["email"], "change": patch or {}, "note": input.note}
    await db.service_cases.update_one({"id": cid}, {"$push": {"trail": trail}})
    await audit(user, "crm.case.update", "case", cid, str(patch))
    return ServiceCase(**clean_doc(await db.service_cases.find_one({"id": cid})))


# ---------------------------------------------------------------- reports

@router.get("/crm/reports/overview")
async def crm_overview(user=Depends(require_role(*CRM_ALL))):
    """Metrics honour row-level scope, so a manager's totals reconcile with their own lists.
    Ad spend/impressions/ROAS are deliberately reported as not connected."""
    scope = await lead_scope_query(user)

    async def count(extra: dict) -> int:
        q = {"$and": [scope, extra]} if scope else extra
        return await db.leads.count_documents(q)

    now = now_utc()
    ist_today = now.astimezone(IST).replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = ist_today.astimezone(timezone.utc)

    registrations = await count({"kind": "registration"})
    cart_opps = await count({"kind": "cart_opportunity"})
    qualified = await count({"qualification": "sales_qualified"})
    converted = await count({"qualification": "converted"})
    open_leads = await count({"is_open": True})
    new_today = await count({"created_at": {"$gte": start_utc}})

    # Conversion denominator is stated explicitly rather than implied.
    denominator = qualified + cart_opps
    conv_rate = round((converted / denominator) * 100, 1) if denominator else 0.0

    fu_scope: dict = {}
    if not has_role(user, OWNER, CRM_MASTER):
        ids = [user["id"]] + (await team_employee_ids(user["id"]) if has_role(user, CRM_MANAGER) else [])
        fu_scope["owner_id"] = {"$in": ids}
    due = await db.follow_ups.count_documents({**fu_scope, "status": "pending", "due_at": {"$lt": start_utc + timedelta(days=1)}})
    overdue = await db.follow_ups.count_documents({**fu_scope, "status": "pending", "due_at": {"$lt": start_utc}})

    calls_total = await db.calls.count_documents({} if has_role(user, OWNER, CRM_MASTER) else {"agent_id": user["id"]})
    connected = await db.calls.count_documents(
        ({} if has_role(user, OWNER, CRM_MASTER) else {"agent_id": user["id"]}) | {"connectivity_code": "connected"}
    )
    unique_leads_called = len(await db.calls.distinct("lead_id", {} if has_role(user, OWNER, CRM_MASTER) else {"agent_id": user["id"]}))

    # Revenue counted ONLY from verified paid orders linked to converted leads.
    conv_q = {"$and": [scope, {"qualification": "converted"}]} if scope else {"qualification": "converted"}
    conv_rows = await db.leads.find(conv_q, {"converted_order_id": 1}).to_list(1000)
    order_ids = [r["converted_order_id"] for r in conv_rows if r.get("converted_order_id")]
    revenue = 0
    if order_ids:
        agg = await db.orders.aggregate([
            {"$match": {"id": {"$in": order_ids}, "payment_status": "paid"}},
            {"$group": {"_id": None, "t": {"$sum": "$amounts.total"}}},
        ]).to_list(1)
        revenue = agg[0]["t"] if agg else 0

    return {
        "registrations": registrations,
        "cart_opportunities": cart_opps,
        "sales_qualified": qualified,
        "converted_paid_orders": converted,
        "open_leads": open_leads,
        "new_today_ist": new_today,
        "conversion_rate_pct": conv_rate,
        "conversion_denominator": "sales-qualified + cart-intent opportunities in your scope",
        "attributed_revenue_paise": revenue,
        "revenue_basis": "verified paid orders linked to converted leads (single attribution)",
        "follow_ups_due": due,
        "follow_ups_overdue": overdue,
        "calls_logged": calls_total,
        "calls_connected": connected,
        "unique_leads_contacted": unique_leads_called,
        "call_telephony_verified": False,
        "ad_spend": "not_connected",
        "impressions": "not_connected",
        "roas": "not_connected",
        "timezone": "Asia/Kolkata",
    }


@router.get("/crm/reports/team")
async def team_report(user=Depends(require_role(OWNER, CRM_MASTER, CRM_MANAGER))):
    """Per-employee workload and outcomes, scoped to what the caller may see."""
    if has_role(user, OWNER, CRM_MASTER):
        staff = await db.users.find({"roles": {"$in": ["crm_employee", "crm_manager"]}, "is_active": True}).to_list(200)
    else:
        ids = await team_employee_ids(user["id"])
        staff = await db.users.find({"id": {"$in": ids}}).to_list(200)
    rows = []
    for s in staff:
        assigned = await db.leads.count_documents({"employee_id": s["id"]})
        converted = await db.leads.count_documents({"employee_id": s["id"], "qualification": "converted"})
        calls = await db.calls.count_documents({"agent_id": s["id"]})
        conn = await db.calls.count_documents({"agent_id": s["id"], "connectivity_code": "connected"})
        overdue = await db.follow_ups.count_documents({"owner_id": s["id"], "status": "pending", "due_at": {"$lt": now_utc()}})
        cases = await db.service_cases.count_documents({"assignee_id": s["id"], "status": {"$in": ["resolved", "closed"]}})
        rows.append({
            "staff_id": s["id"], "name": s["name"], "email": s["email"],
            "roles": s.get("roles", []), "assigned_leads": assigned, "conversions": converted,
            "calls_logged": calls, "connected_calls": conn,
            "connect_rate_pct": round((conn / calls) * 100, 1) if calls else 0.0,
            "follow_ups_overdue": overdue, "cases_resolved": cases,
        })
    return {"total": len(rows), "rows": rows}
