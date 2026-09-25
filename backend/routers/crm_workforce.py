"""Workforce, Shift, Server-Enforced Attendance & Leave Management Router."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

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
from models.crm_workforce import (
    AttendanceCorrection,
    AttendanceCorrectionIn,
    AttendanceSession,
    BreakIn,
    BreakRecord,
    ClockInIn,
    CorrectionReviewIn,
    LeaveRequest,
    LeaveRequestIn,
    LeaveReviewIn,
    LeaveType,
)

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))
CRM_ALL = (OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)
CRM_MANAGERS = (OWNER, CRM_MASTER, CRM_MANAGER)
CRM_ADMINS = (OWNER, CRM_MASTER)


def today_ist() -> str:
    return datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m-%d")


def calc_session_durations(session: dict) -> dict:
    """Calculate gross, break, and net minutes dynamically."""
    now = now_utc()
    clock_in = session.get("clock_in_at")
    if not clock_in:
        return session
    
    clock_out = session.get("clock_out_at")
    end_point = clock_out or now
    
    gross_minutes = max(0.0, (end_point - clock_in).total_seconds() / 60.0)
    
    break_minutes = 0.0
    breaks = session.get("breaks", [])
    for b in breaks:
        b_start = b.get("start_at")
        b_end = b.get("end_at") or (now if not clock_out else end_point)
        if b_start and b_end:
            dur = max(0.0, (b_end - b_start).total_seconds() / 60.0)
            b["duration_minutes"] = round(dur, 1)
            break_minutes += dur
            
    net_minutes = max(0.0, gross_minutes - break_minutes)
    
    session["gross_minutes"] = round(gross_minutes, 1)
    session["break_minutes"] = round(break_minutes, 1)
    session["net_minutes"] = round(net_minutes, 1)
    return session


# ---------------------------------------------------------------- ATTENDANCE / SHIFTS

@router.get("/crm/workforce/my-status")
async def get_my_workforce_status(user=Depends(require_role(*CRM_ALL))):
    """Returns the employee's current day attendance, shift, and clock state."""
    cur_date = today_ist()
    session = await db.attendance_sessions.find_one({"employee_id": user["id"], "date": cur_date})
    
    if not session:
        return {
            "date": cur_date,
            "shift_name": "Standard Day Shift (09:30 AM - 06:30 PM)",
            "is_clocked_in": False,
            "is_on_break": False,
            "session": None,
        }
        
    session = calc_session_durations(clean_doc(session))
    
    # Check if currently on an open break
    is_on_break = any(b.get("end_at") is None for b in session.get("breaks", []))
    is_clocked_in = session.get("clock_in_at") is not None and session.get("clock_out_at") is None
    
    return {
        "date": cur_date,
        "shift_name": session.get("shift_name", "Standard Day Shift (09:30 AM - 06:30 PM)"),
        "is_clocked_in": is_clocked_in,
        "is_on_break": is_on_break,
        "session": session,
    }


@router.post("/crm/workforce/clock-in")
async def clock_in(input: ClockInIn, user=Depends(require_role(*CRM_ALL))):
    """Enforces server-timestamped clock-in. Prevent duplicate open shifts."""
    cur_date = today_ist()
    now = now_utc()
    
    existing = await db.attendance_sessions.find_one({"employee_id": user["id"], "date": cur_date})
    if existing and existing.get("clock_in_at"):
        if not existing.get("clock_out_at"):
            raise HTTPException(status_code=400, detail="You are already clocked in for today.")
        else:
            raise HTTPException(status_code=400, detail="Shift already completed for today. Submit a correction if needed.")
            
    # Determine late arrival (Shift starts 09:30 AM IST, grace threshold 09:45 AM IST)
    ist_time = now.astimezone(IST)
    is_late = (ist_time.hour > 9) or (ist_time.hour == 9 and ist_time.minute > 45)
    
    session_data = AttendanceSession(
        employee_id=user["id"],
        employee_name=user["name"],
        employee_email=user["email"],
        manager_id=user.get("reporting_to") or user.get("crm_manager_id"),
        date=cur_date,
        shift_name=input.shift_name or "Standard Day Shift (09:30 AM - 06:30 PM)",
        clock_in_at=now,
        status="late" if is_late else "present",
        is_late=is_late,
    ).model_dump()
    
    if existing:
        await db.attendance_sessions.update_one({"id": existing["id"]}, {"$set": session_data})
    else:
        await db.attendance_sessions.insert_one(session_data)
        
    await audit(user, "crm.attendance.clock_in", "attendance_session", session_data["id"])
    return {"message": "Clock in successful", "session": clean_doc(session_data)}


@router.post("/crm/workforce/break-start")
async def break_start(input: BreakIn, user=Depends(require_role(*CRM_ALL))):
    """Start an employee break."""
    cur_date = today_ist()
    session = await db.attendance_sessions.find_one({"employee_id": user["id"], "date": cur_date, "clock_out_at": None})
    if not session or not session.get("clock_in_at"):
        raise HTTPException(status_code=400, detail="You must be clocked in to take a break.")
        
    # Check if already on break
    breaks = session.get("breaks", [])
    if any(b.get("end_at") is None for b in breaks):
        raise HTTPException(status_code=400, detail="You are already on an active break.")
        
    now = now_utc()
    new_break = BreakRecord(start_at=now, reason=input.reason).model_dump()
    breaks.append(new_break)
    
    await db.attendance_sessions.update_one({"id": session["id"]}, {"$set": {"breaks": breaks, "updated_at": now}})
    return {"message": "Break started", "break": new_break}


@router.post("/crm/workforce/break-end")
async def break_end(user=Depends(require_role(*CRM_ALL))):
    """End an employee break and record duration."""
    cur_date = today_ist()
    session = await db.attendance_sessions.find_one({"employee_id": user["id"], "date": cur_date, "clock_out_at": None})
    if not session:
        raise HTTPException(status_code=400, detail="No active shift found.")
        
    breaks = session.get("breaks", [])
    open_break = next((b for b in breaks if b.get("end_at") is None), None)
    if not open_break:
        raise HTTPException(status_code=400, detail="No active break to end.")
        
    now = now_utc()
    open_break["end_at"] = now
    dur = max(0.0, (now - open_break["start_at"]).total_seconds() / 60.0)
    open_break["duration_minutes"] = round(dur, 1)
    
    await db.attendance_sessions.update_one({"id": session["id"]}, {"$set": {"breaks": breaks, "updated_at": now}})
    return {"message": "Break ended", "duration_minutes": open_break["duration_minutes"]}


@router.post("/crm/workforce/clock-out")
async def clock_out(user=Depends(require_role(*CRM_ALL))):
    """Clock out for the day, closing active breaks and computing final working duration."""
    cur_date = today_ist()
    session = await db.attendance_sessions.find_one({"employee_id": user["id"], "date": cur_date, "clock_out_at": None})
    if not session or not session.get("clock_in_at"):
        raise HTTPException(status_code=400, detail="No active clocked-in shift found for today.")
        
    now = now_utc()
    
    # Close any active break
    breaks = session.get("breaks", [])
    for b in breaks:
        if b.get("end_at") is None:
            b["end_at"] = now
            b["duration_minutes"] = round((now - b["start_at"]).total_seconds() / 60.0, 1)
            
    session["breaks"] = breaks
    session["clock_out_at"] = now
    
    calc_session_durations(session)
    
    # Calculate half-day threshold (e.g. less than 240 net minutes is half-day)
    if session["net_minutes"] < 240.0:
        session["status"] = "half_day"
        
    await db.attendance_sessions.update_one({"id": session["id"]}, {"$set": session})
    await audit(user, "crm.attendance.clock_out", "attendance_session", session["id"])
    return {"message": "Clock out successful", "session": clean_doc(session)}


@router.get("/crm/workforce/my-calendar")
async def get_my_calendar(month: Optional[str] = None, user=Depends(require_role(*CRM_ALL))):
    """Returns monthly attendance days for the employee."""
    cur_month = month or datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m")
    regex = f"^{cur_month}"
    
    docs = await db.attendance_sessions.find({
        "employee_id": user["id"],
        "date": {"$regex": regex}
    }).sort("date", 1).to_list(40)
    
    out = [calc_session_durations(clean_doc(d)) for d in docs]
    return out


@router.get("/crm/workforce/attendance-list")
async def list_attendance(
    date: Optional[str] = None,
    employee_id: Optional[str] = None,
    manager_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(require_role(*CRM_MANAGERS))
):
    """Admin and Manager overview of workforce attendance."""
    query: dict = {}
    if date:
        query["date"] = date
    else:
        query["date"] = today_ist()
        
    if has_role(user, CRM_MANAGER) and not has_role(user, OWNER, CRM_MASTER):
        # Manager restricted to own team
        team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
        team_ids = [m["id"] for m in team_members]
        team_ids.append(user["id"])
        query["employee_id"] = {"$in": team_ids}
    elif employee_id:
        query["employee_id"] = employee_id
    elif manager_id:
        query["manager_id"] = manager_id
        
    if status:
        query["status"] = status
        
    docs = await db.attendance_sessions.find(query).sort("created_at", -1).to_list(200)
    return [calc_session_durations(clean_doc(d)) for d in docs]


@router.get("/crm/workforce/stats")
async def get_workforce_stats(date: Optional[str] = None, user=Depends(require_role(*CRM_MANAGERS))):
    """Summary counts for workforce attendance dashboard."""
    target_date = date or today_ist()
    query: dict = {"date": target_date}
    
    if has_role(user, CRM_MANAGER) and not has_role(user, OWNER, CRM_MASTER):
        team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
        team_ids = [m["id"] for m in team_members] + [user["id"]]
        query["employee_id"] = {"$in": team_ids}
        total_staff = len(team_ids)
    else:
        total_staff = await db.users.count_documents({"roles": {"$in": ["crm_employee", "crm_manager"]}, "is_active": True})
        
    sessions = await db.attendance_sessions.find(query).to_list(500)
    
    clocked_in = 0
    on_break = 0
    late = 0
    clocked_out = 0
    
    for s in sessions:
        if s.get("clock_in_at") and not s.get("clock_out_at"):
            clocked_in += 1
            if any(b.get("end_at") is None for b in s.get("breaks", [])):
                on_break += 1
        elif s.get("clock_out_at"):
            clocked_out += 1
        if s.get("is_late"):
            late += 1
            
    on_leave = await db.leave_requests.count_documents({
        "status": "approved",
        "from_date": {"$lte": target_date},
        "to_date": {"$gte": target_date}
    })
    
    not_clocked_in = max(0, total_staff - (clocked_in + clocked_out + on_leave))
    
    return {
        "date": target_date,
        "total_staff": total_staff,
        "clocked_in": clocked_in,
        "on_break": on_break,
        "clocked_out": clocked_out,
        "late": late,
        "on_leave": on_leave,
        "not_clocked_in": not_clocked_in,
    }


# ---------------------------------------------------------------- CORRECTIONS

@router.post("/crm/workforce/corrections")
async def request_correction(input: AttendanceCorrectionIn, user=Depends(require_role(*CRM_ALL))):
    """Submit attendance correction request with reason and proposed times."""
    corr = AttendanceCorrection(
        employee_id=user["id"],
        employee_name=user["name"],
        date=input.date,
        requested_clock_in=input.requested_clock_in,
        requested_clock_out=input.requested_clock_out,
        reason=input.reason,
    ).model_dump()
    
    await db.attendance_corrections.insert_one(corr)
    await audit(user, "crm.attendance.correction_request", "attendance_correction", corr["id"])
    return clean_doc(corr)


@router.get("/crm/workforce/corrections")
async def list_corrections(status: Optional[str] = None, user=Depends(require_role(*CRM_ALL))):
    """Role-scoped list of correction requests."""
    query: dict = {}
    if status:
        query["status"] = status
        
    if not has_role(user, OWNER, CRM_MASTER):
        if has_role(user, CRM_MANAGER):
            team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
            query["employee_id"] = {"$in": [m["id"] for m in team_members] + [user["id"]]}
        else:
            query["employee_id"] = user["id"]
            
    docs = await db.attendance_corrections.find(query).sort("created_at", -1).to_list(100)
    return [clean_doc(d) for d in docs]


@router.post("/crm/workforce/corrections/{cid}/review")
async def review_correction(cid: str, input: CorrectionReviewIn, user=Depends(require_role(*CRM_MANAGERS))):
    """Manager or Admin approves/rejects correction, modifying actual attendance session upon approval."""
    corr = await db.attendance_corrections.find_one({"id": cid})
    if not corr:
        raise HTTPException(status_code=404, detail="Correction request not found")
        
    now = now_utc()
    update_data = {
        "status": input.status,
        "reviewed_by": user["name"],
        "reviewer_note": input.note,
        "reviewed_at": now,
    }
    
    await db.attendance_corrections.update_one({"id": cid}, {"$set": update_data})
    
    if input.status == "approved":
        # Mutate the actual session
        gross_minutes = (corr["requested_clock_out"] - corr["requested_clock_in"]).total_seconds() / 60.0
        session_update = {
            "clock_in_at": corr["requested_clock_in"],
            "clock_out_at": corr["requested_clock_out"],
            "gross_minutes": round(gross_minutes, 1),
            "net_minutes": round(gross_minutes, 1),
            "status": "present",
            "updated_at": now,
        }
        await db.attendance_sessions.update_one(
            {"employee_id": corr["employee_id"], "date": corr["date"]},
            {"$set": session_update},
            upsert=True
        )
        
    await audit(user, f"crm.attendance.correction_{input.status}", "attendance_correction", cid)
    return {"message": f"Correction request {input.status}"}


# ---------------------------------------------------------------- LEAVE MANAGEMENT

@router.get("/crm/leave/types")
async def get_leave_types(user=Depends(require_role(*CRM_ALL))):
    """Configured leave types with annual allowances."""
    default_types = [
        {"code": "casual", "label": "Casual Leave (CL)", "annual_allowance": 12, "is_paid": True},
        {"code": "sick", "label": "Sick Leave (SL)", "annual_allowance": 8, "is_paid": True},
        {"code": "paid", "label": "Privilege / Paid Leave (PL)", "annual_allowance": 15, "is_paid": True},
        {"code": "unpaid", "label": "Loss of Pay (LOP)", "annual_allowance": 0, "is_paid": False},
        {"code": "comp_off", "label": "Compensatory Off", "annual_allowance": 5, "is_paid": True},
    ]
    return default_types


@router.get("/crm/leave/my-balance")
async def get_my_leave_balance(user=Depends(require_role(*CRM_ALL))):
    """Calculates available, used, pending, and remaining balances for the user."""
    requests = await db.leave_requests.find({"employee_id": user["id"]}).to_list(200)
    
    types = await get_leave_types(user)
    balances = {}
    
    for t in types:
        code = t["code"]
        allowance = t["annual_allowance"]
        used = sum(r.get("days_count", 1.0) for r in requests if r.get("leave_type_code") == code and r.get("status") == "approved")
        pending = sum(r.get("days_count", 1.0) for r in requests if r.get("leave_type_code") == code and r.get("status") == "pending")
        balances[code] = {
            "label": t["label"],
            "allowance": allowance,
            "used": used,
            "pending": pending,
            "remaining": max(0.0, allowance - used),
            "is_paid": t["is_paid"],
        }
    return balances


@router.post("/crm/leave/apply")
async def apply_leave(input: LeaveRequestIn, user=Depends(require_role(*CRM_ALL))):
    """Employee applies for leave."""
    types = {t["code"]: t["label"] for t in await get_leave_types(user)}
    label = types.get(input.leave_type_code, input.leave_type_code)
    
    req = LeaveRequest(
        employee_id=user["id"],
        employee_name=user["name"],
        employee_email=user["email"],
        manager_id=user.get("reporting_to") or user.get("crm_manager_id"),
        leave_type_code=input.leave_type_code,
        leave_type_label=label,
        from_date=input.from_date,
        to_date=input.to_date,
        days_count=input.days_count,
        is_half_day=input.is_half_day,
        reason=input.reason,
    ).model_dump()
    
    await db.leave_requests.insert_one(req)
    await audit(user, "crm.leave.apply", "leave_request", req["id"])
    return clean_doc(req)


@router.get("/crm/leave/requests")
async def list_leave_requests(status: Optional[str] = None, user=Depends(require_role(*CRM_ALL))):
    """Role-scoped leave requests (employee sees own, manager sees team, admin sees all)."""
    query: dict = {}
    if status:
        query["status"] = status
        
    if not has_role(user, OWNER, CRM_MASTER):
        if has_role(user, CRM_MANAGER):
            team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
            query["employee_id"] = {"$in": [m["id"] for m in team_members] + [user["id"]]}
        else:
            query["employee_id"] = user["id"]
            
    docs = await db.leave_requests.find(query).sort("created_at", -1).to_list(150)
    return [clean_doc(d) for d in docs]


@router.post("/crm/leave/requests/{lid}/review")
async def review_leave_request(lid: str, input: LeaveReviewIn, user=Depends(require_role(*CRM_MANAGERS))):
    """Manager or Admin approves/rejects leave request."""
    req = await db.leave_requests.find_one({"id": lid})
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
        
    now = now_utc()
    await db.leave_requests.update_one({"id": lid}, {"$set": {
        "status": input.status,
        "reviewed_by": user["name"],
        "reviewer_note": input.note,
        "reviewed_at": now,
    }})
    
    # If approved, update attendance sessions for those days
    if input.status == "approved":
        # Create attendance record marked as 'on_leave'
        start_d = datetime.strptime(req["from_date"], "%Y-%m-%d")
        end_d = datetime.strptime(req["to_date"], "%Y-%m-%d")
        delta = (end_d - start_d).days + 1
        
        for i in range(delta):
            day_str = (start_d + timedelta(days=i)).strftime("%Y-%m-%d")
            await db.attendance_sessions.update_one(
                {"employee_id": req["employee_id"], "date": day_str},
                {"$set": {
                    "employee_id": req["employee_id"],
                    "employee_name": req["employee_name"],
                    "employee_email": req["employee_email"],
                    "date": day_str,
                    "status": "on_leave",
                    "gross_minutes": 0.0,
                    "net_minutes": 0.0,
                    "updated_at": now,
                }},
                upsert=True
            )
            
    await audit(user, f"crm.leave.{input.status}", "leave_request", lid)
    return {"message": f"Leave request {input.status}"}
