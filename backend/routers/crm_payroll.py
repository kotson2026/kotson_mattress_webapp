"""CRM Payroll Router: monthly attendance-driven calculation, review, approval & payslips."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

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
from models.crm_workforce import PayrollAdjustIn, PayrollPeriod, PayrollRecord, SalaryStructure

router = APIRouter()

CRM_ALL = (OWNER, CRM_MASTER, CRM_MANAGER, CRM_EMPLOYEE)
CRM_ADMINS = (OWNER, CRM_MASTER)


@router.get("/crm/payroll/periods")
async def list_payroll_periods(user=Depends(require_role(*CRM_ALL))):
    """List payroll periods with aggregate totals and statuses."""
    docs = await db.payroll_periods.find({}).sort("month", -1).to_list(50)
    return [clean_doc(d) for d in docs]


@router.post("/crm/payroll/periods")
async def create_payroll_period(month: str, name: Optional[str] = None, user=Depends(require_role(*CRM_ADMINS))):
    """Create a new monthly payroll period (e.g. '2026-09')."""
    existing = await db.payroll_periods.find_one({"month": month})
    if existing:
        return clean_doc(existing)
        
    p_name = name or datetime.strptime(month, "%Y-%m").strftime("%B %Y")
    period = PayrollPeriod(month=month, name=p_name).model_dump()
    await db.payroll_periods.insert_one(period)
    await audit(user, "crm.payroll.create_period", "payroll_period", period["id"], month)
    return clean_doc(period)


@router.post("/crm/payroll/periods/{pid}/calculate")
async def calculate_payroll(pid: str, working_days: int = 26, user=Depends(require_role(*CRM_ADMINS))):
    """Calculates payroll inputs for all CRM staff from attendance and leave records."""
    period = await db.payroll_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")
        
    if period.get("status") in ("approved", "paid"):
        raise HTTPException(status_code=400, detail=f"Cannot recalculate an {period['status']} payroll period")
        
    month = period["month"]
    month_regex = f"^{month}"
    
    # Fetch all active CRM staff
    staff = await db.users.find({"roles": {"$in": ["crm_employee", "crm_manager"]}, "is_active": True}).to_list(100)
    
    total_gross = 0
    total_deductions = 0
    total_net = 0
    
    # Clear existing draft records for this period
    await db.payroll_records.delete_many({"period_id": pid, "status": "draft"})
    
    for s in staff:
        # Check salary structure
        salary_doc = await db.salary_structures.find_one({"employee_id": s["id"]})
        gross_monthly = salary_doc.get("monthly_gross_paise", 3500000) if salary_doc else 3500000
        
        # Query attendance sessions for month
        sessions = await db.attendance_sessions.find({
            "employee_id": s["id"],
            "date": {"$regex": month_regex}
        }).to_list(40)
        
        present_count = 0.0
        half_day_count = 0
        
        for sess in sessions:
            st = sess.get("status")
            if st in ("present", "late"):
                present_count += 1.0
            elif st == "half_day":
                present_count += 0.5
                half_day_count += 1
                
        # Query approved leaves
        leaves = await db.leave_requests.find({
            "employee_id": s["id"],
            "status": "approved",
            "from_date": {"$regex": month_regex}
        }).to_list(30)
        
        paid_leaves = sum(l.get("days_count", 1.0) for l in leaves if l.get("leave_type_code") != "unpaid")
        unpaid_leaves = sum(l.get("days_count", 1.0) for l in leaves if l.get("leave_type_code") == "unpaid")
        
        # In a typical month: working days minus present & paid leave equals absent / LOP days
        accounted_days = present_count + paid_leaves
        absent_days = max(0.0, float(working_days) - accounted_days)
        
        per_day_rate = gross_monthly / float(working_days)
        lop_deduction = int(round(absent_days * per_day_rate))
        net_payable = max(0, gross_monthly - lop_deduction)
        
        rec = PayrollRecord(
            period_id=pid,
            month=month,
            employee_id=s["id"],
            employee_name=s["name"],
            employee_role=s.get("roles", ["EMPLOYEE"])[0].upper(),
            manager_id=s.get("reporting_to") or s.get("crm_manager_id"),
            working_days=working_days,
            present_days=present_count,
            paid_leaves=paid_leaves,
            unpaid_leaves=unpaid_leaves,
            half_days=half_day_count,
            absent_days=absent_days,
            gross_salary_paise=gross_monthly,
            lop_deduction_paise=lop_deduction,
            net_payable_paise=net_payable,
            status="draft",
        ).model_dump()
        
        await db.payroll_records.insert_one(rec)
        
        total_gross += gross_monthly
        total_deductions += lop_deduction
        total_net += net_payable
        
    await db.payroll_periods.update_one(
        {"id": pid},
        {"$set": {
            "status": "calculated",
            "working_days": working_days,
            "total_gross_paise": total_gross,
            "total_deductions_paise": total_deductions,
            "total_net_paise": total_net,
        }}
    )
    
    await audit(user, "crm.payroll.calculate", "payroll_period", pid)
    return {"message": "Payroll calculated successfully", "records_count": len(staff)}


@router.get("/crm/payroll/periods/{pid}/records")
async def list_payroll_records(pid: str, user=Depends(require_role(*CRM_ALL))):
    """Scoped payroll records for a period."""
    query: dict = {"period_id": pid}
    
    if not has_role(user, OWNER, CRM_MASTER):
        if has_role(user, CRM_MANAGER):
            team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
            query["employee_id"] = {"$in": [m["id"] for m in team_members] + [user["id"]]}
        else:
            query["employee_id"] = user["id"]
            
    docs = await db.payroll_records.find(query).sort("employee_name", 1).to_list(200)
    return [clean_doc(d) for d in docs]


@router.patch("/crm/payroll/records/{rid}")
async def adjust_payroll_record(rid: str, input: PayrollAdjustIn, user=Depends(require_role(*CRM_ADMINS))):
    """Admin adjustments (incentives, deductions, overtime, notes)."""
    rec = await db.payroll_records.find_one({"id": rid})
    if not rec:
        raise HTTPException(status_code=404, detail="Payroll record not found")
        
    updates: dict = {}
    if input.incentives_paise is not None:
        updates["incentives_paise"] = input.incentives_paise
    if input.deductions_paise is not None:
        updates["deductions_paise"] = input.deductions_paise
    if input.overtime_paise is not None:
        updates["overtime_paise"] = input.overtime_paise
    if input.notes is not None:
        updates["notes"] = input.notes
        
    # Recalculate net payable
    gross = rec["gross_salary_paise"]
    lop = rec["lop_deduction_paise"]
    inc = updates.get("incentives_paise", rec.get("incentives_paise", 0))
    ded = updates.get("deductions_paise", rec.get("deductions_paise", 0))
    ot = updates.get("overtime_paise", rec.get("overtime_paise", 0))
    
    net = max(0, gross - lop + inc - ded + ot)
    updates["net_payable_paise"] = net
    updates["status"] = "reviewed"
    updates["updated_at"] = now_utc()
    
    await db.payroll_records.update_one({"id": rid}, {"$set": updates})
    await audit(user, "crm.payroll.adjust_record", "payroll_record", rid)
    return {"message": "Payroll record adjusted", "net_payable_paise": net}


@router.post("/crm/payroll/periods/{pid}/approve")
async def approve_payroll_period(pid: str, user=Depends(require_role(*CRM_ADMINS))):
    """Approves and locks payroll for the month."""
    period = await db.payroll_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")
        
    now = now_utc()
    await db.payroll_periods.update_one({"id": pid}, {"$set": {
        "status": "approved",
        "approved_by": user["name"],
        "approved_at": now,
    }})
    
    await db.payroll_records.update_many({"period_id": pid}, {"$set": {
        "status": "approved",
        "updated_at": now,
    }})
    
    await audit(user, "crm.payroll.approve_period", "payroll_period", pid)
    return {"message": "Payroll period approved and locked"}


@router.post("/crm/payroll/periods/{pid}/mark-paid")
async def mark_payroll_paid(pid: str, payment_reference: str = Query(..., min_length=3), user=Depends(require_role(*CRM_ADMINS))):
    """Confirms offline salary disbursement reference. Does NOT automate bank mutations."""
    period = await db.payroll_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")
        
    now = now_utc()
    await db.payroll_periods.update_one({"id": pid}, {"$set": {
        "status": "paid",
        "paid_at": now,
        "payment_reference": payment_reference,
    }})
    
    await db.payroll_records.update_many({"period_id": pid}, {"$set": {
        "status": "paid",
        "updated_at": now,
    }})
    
    await audit(user, "crm.payroll.mark_paid", "payroll_period", pid, payment_reference)
    return {"message": "Payroll marked as paid"}


@router.get("/crm/payroll/payslip/{rid}")
async def get_payslip(rid: str, user=Depends(require_role(*CRM_ALL))):
    """Structured payslip for viewing or printing."""
    rec = await db.payroll_records.find_one({"id": rid})
    if not rec:
        raise HTTPException(status_code=404, detail="Payroll record not found")
        
    # Check access
    if not has_role(user, OWNER, CRM_MASTER):
        if has_role(user, CRM_MANAGER):
            team_members = await db.users.find({"crm_manager_id": user["id"]}).to_list(100)
            team_ids = [m["id"] for m in team_members] + [user["id"]]
            if rec["employee_id"] not in team_ids:
                raise HTTPException(status_code=403, detail="Unauthorized")
        elif rec["employee_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Unauthorized")
            
    period = await db.payroll_periods.find_one({"id": rec["period_id"]})
    return {
        "company": "Kotson Mattress Pvt Ltd",
        "period": clean_doc(period) if period else None,
        "payslip": clean_doc(rec),
    }
