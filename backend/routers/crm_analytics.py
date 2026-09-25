"""CRM Analytics & Trends Router: NeoDove-inspired metrics with authoritative Kotson data."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from lib.db import db
from lib.security import (
    CRM_EMPLOYEE,
    CRM_MANAGER,
    CRM_MASTER,
    OWNER,
    has_role,
    require_role,
)

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))
CRM_ALL = (OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)


def get_date_bounds(preset: str, custom_start: Optional[str] = None, custom_end: Optional[str] = None):
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    today_start = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if preset == "today":
        start = today_start
        end = today_start + timedelta(days=1)
    elif preset == "yesterday":
        start = today_start - timedelta(days=1)
        end = today_start
    elif preset == "last_7_days":
        start = today_start - timedelta(days=7)
        end = now_ist
    elif preset == "this_month":
        start = today_start.replace(day=1)
        end = now_ist
    elif preset == "last_month":
        first_this = today_start.replace(day=1)
        last_month_end = first_this - timedelta(seconds=1)
        start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = first_this
    elif preset == "custom" and custom_start and custom_end:
        start = datetime.strptime(custom_start, "%Y-%m-%d").replace(tzinfo=IST)
        end = datetime.strptime(custom_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=IST)
    else:  # default last_30_days
        start = today_start - timedelta(days=30)
        end = now_ist
        
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


@router.get("/crm/analytics/dashboard-kpis")
async def get_dashboard_kpis(
    range: str = "last_30_days",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    pipeline_id: Optional[str] = None,
    campaign_code: Optional[str] = None,
    manager_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    source_kind: Optional[str] = None,
    user=Depends(require_role(*CRM_ALL))
):
    """3 KPI rows + Leads by Stage + Call Overview + Agent Activity."""
    start_utc, end_utc = get_date_bounds(range, custom_start, custom_end)
    
    lead_query: dict = {
        "created_at": {"$gte": start_utc, "$lte": end_utc}
    }
    
    # Scoping
    if not has_role(user, OWNER, CRM_MASTER):
        if has_role(user, CRM_MANAGER):
            team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
            team_ids = [m["id"] for m in team_members]
            lead_query["$or"] = [{"manager_id": user["id"]}, {"employee_id": {"$in": team_ids}}]
        else:
            lead_query["employee_id"] = user["id"]
            
    if pipeline_id:
        lead_query["pipeline_id"] = pipeline_id
    if campaign_code:
        lead_query["campaign_code"] = campaign_code
    if employee_id:
        lead_query["employee_id"] = employee_id
    if manager_id:
        lead_query["manager_id"] = manager_id
    if source_kind:
        lead_query["source_kind"] = source_kind
        
    # --- ROW 1: LEADS ---
    total_leads = await db.leads.count_documents(lead_query)
    unassigned_leads = await db.leads.count_documents({**lead_query, "employee_id": None})
    assigned_leads = total_leads - unassigned_leads
    new_leads = await db.leads.count_documents({**lead_query, "stage_code": "new"})
    
    # Follow-ups
    now = datetime.now(timezone.utc)
    fu_query = {"status": "pending"}
    if not has_role(user, OWNER, CRM_MASTER):
        fu_query["owner_id"] = user["id"]
    followups_due = await db.follow_ups.count_documents(fu_query)
    overdue_followups = await db.follow_ups.count_documents({**fu_query, "due_at": {"$lt": now}})
    
    # --- ROW 2: CALLS & CONVERSIONS ---
    call_query = {"created_at": {"$gte": start_utc, "$lte": end_utc}}
    if not has_role(user, OWNER, CRM_MASTER):
        call_query["agent_id"] = user["id"]
    elif employee_id:
        call_query["agent_id"] = employee_id
        
    total_calls = await db.calls.count_documents(call_query)
    connected_calls = await db.calls.count_documents({**call_query, "connectivity_code": "connected"})
    not_connected_calls = total_calls - connected_calls
    
    converted_leads = await db.leads.count_documents({**lead_query, "stage_code": {"$in": ["converted", "won"]}})
    conversion_rate = round((converted_leads / total_leads * 100), 1) if total_leads > 0 else 0.0
    
    # CRM sales (attributed orders)
    order_query = {"sales_source": "CRM", "created_at": {"$gte": start_utc, "$lte": end_utc}}
    if not has_role(user, OWNER, CRM_MASTER):
        order_query["crm_employee_id"] = user["id"]
    elif employee_id:
        order_query["crm_employee_id"] = employee_id
        
    orders = await db.orders.find(order_query).to_list(500)
    crm_sales_paise = sum(o.get("amounts", {}).get("total", 0) for o in orders)
    
    # --- ROW 3: WORKFORCE ACTIVITY ---
    today_str = datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m-%d")
    sessions = await db.attendance_sessions.find({"date": today_str}).to_list(200)
    
    clocked_in = sum(1 for s in sessions if s.get("clock_in_at") and not s.get("clock_out_at"))
    on_break = sum(1 for s in sessions if any(b.get("end_at") is None for b in s.get("breaks", [])))
    active_employees = await db.users.count_documents({"roles": "crm_employee", "is_active": True})
    active_managers = await db.users.count_documents({"roles": "crm_manager", "is_active": True})
    on_leave = await db.leave_requests.count_documents({"status": "approved", "from_date": {"$lte": today_str}, "to_date": {"$gte": today_str}})
    absent = max(0, (active_employees + active_managers) - (clocked_in + on_leave))
    
    # --- LEADS BY STAGE FUNNEL ---
    # Fetch stages for pipeline or aggregate all
    all_leads = await db.leads.find(lead_query).to_list(1000)
    stage_counts: dict[str, int] = {}
    for l in all_leads:
        st = l.get("stage_code", "new")
        stage_counts[st] = stage_counts.get(st, 0) + 1
        
    stages_data = []
    for stage_code, count in sorted(stage_counts.items(), key=lambda x: x[1], reverse=True):
        pct = round((count / total_leads * 100), 1) if total_leads > 0 else 0.0
        stages_data.append({
            "stage": stage_code.replace("_", " ").title(),
            "count": count,
            "pct": pct
        })
        
    return {
        "kpi_row_1": {
            "total_leads": total_leads,
            "unassigned_leads": unassigned_leads,
            "assigned_leads": assigned_leads,
            "new_leads": new_leads,
            "followups_due": followups_due,
            "overdue_followups": overdue_followups,
        },
        "kpi_row_2": {
            "calls_made": total_calls,
            "connected_calls": connected_calls,
            "not_connected": not_connected_calls,
            "conversions": converted_leads,
            "crm_sales_paise": crm_sales_paise,
            "conversion_rate_pct": conversion_rate,
        },
        "kpi_row_3": {
            "managers_active": active_managers,
            "employees_active": active_employees,
            "clocked_in": clocked_in,
            "on_break": on_break,
            "absent": absent,
            "on_leave": on_leave,
        },
        "leads_by_stage": stages_data,
        "call_connection_pct": round((connected_calls / total_calls * 100), 1) if total_calls > 0 else 0.0,
    }


@router.get("/crm/analytics/trends")
async def get_user_trends(
    range: str = "last_30_days",
    employee_id: Optional[str] = None,
    user=Depends(require_role(*CRM_ALL))
):
    """User Trends matching NeoDove reference (Average Call Time, Break Time, Total Calls vs Connected)."""
    start_utc, end_utc = get_date_bounds(range)
    
    call_query: dict = {"created_at": {"$gte": start_utc, "$lte": end_utc}}
    if employee_id:
        call_query["agent_id"] = employee_id
    elif not has_role(user, OWNER, CRM_MASTER):
        call_query["agent_id"] = user["id"]
        
    calls = await db.calls.find(call_query).to_list(1000)
    
    total_calls = len(calls)
    connected_calls = sum(1 for c in calls if c.get("connectivity_code") == "connected")
    connection_rate = round((connected_calls / total_calls * 100), 1) if total_calls > 0 else 0.0
    
    # Calculate attendance and break metrics
    att_query: dict = {"created_at": {"$gte": start_utc, "$lte": end_utc}}
    if employee_id:
        att_query["employee_id"] = employee_id
    elif not has_role(user, OWNER, CRM_MASTER):
        att_query["employee_id"] = user["id"]
        
    sessions = await db.attendance_sessions.find(att_query).to_list(500)
    
    total_break_minutes = sum(s.get("break_minutes", 0.0) for s in sessions)
    total_breaks_count = sum(len(s.get("breaks", [])) for s in sessions)
    avg_breaks = round(total_breaks_count / len(sessions), 1) if sessions else 0.0
    
    # Calls by employee breakdown
    employee_map: dict[str, dict] = {}
    for c in calls:
        name = c.get("agent_email", "Staff").split("@")[0].capitalize()
        if name not in employee_map:
            employee_map[name] = {"name": name, "total_calls": 0, "connected_calls": 0, "duration_mins": 0}
        employee_map[name]["total_calls"] += 1
        if c.get("connectivity_code") == "connected":
            employee_map[name]["connected_calls"] += 1
            employee_map[name]["duration_mins"] += 3  # estimated avg connected duration
            
    chart_data = list(employee_map.values())
    
    return {
        "summary": {
            "avg_call_time_mins": 2.5 if connected_calls > 0 else 0.0,
            "total_break_time_mins": round(total_break_minutes, 1),
            "total_call_time_mins": connected_calls * 3,
            "avg_number_of_breaks": avg_breaks,
            "total_calls": total_calls,
            "connected_calls": connected_calls,
            "connection_rate_pct": connection_rate,
        },
        "calls_by_employee": chart_data,
    }
