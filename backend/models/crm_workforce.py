"""Models for Workforce, Attendance, Leave Management, and Payroll."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional, Dict
from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------- ATTENDANCE & SHIFTS

class BreakRecord(BaseModel):
    id: str = Field(default_factory=_id)
    start_at: datetime
    end_at: Optional[datetime] = None
    duration_minutes: float = 0.0
    reason: Optional[str] = "Normal Break"


class AttendanceSession(BaseModel):
    id: str = Field(default_factory=_id)
    employee_id: str
    employee_name: str
    employee_email: str
    manager_id: Optional[str] = None
    date: str  # YYYY-MM-DD in IST
    shift_name: str = "Standard Day Shift (09:30 AM - 06:30 PM)"
    clock_in_at: Optional[datetime] = None
    clock_out_at: Optional[datetime] = None
    breaks: List[BreakRecord] = Field(default_factory=list)
    status: Literal["present", "late", "half_day", "absent", "on_leave", "holiday", "weekly_off"] = "present"
    gross_minutes: float = 0.0
    break_minutes: float = 0.0
    net_minutes: float = 0.0
    is_late: bool = False
    is_early_departure: bool = False
    is_test_data: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ClockInIn(BaseModel):
    shift_name: Optional[str] = "Standard Day Shift (09:30 AM - 06:30 PM)"


class BreakIn(BaseModel):
    reason: Optional[str] = "Lunch / Tea Break"


class AttendanceCorrectionIn(BaseModel):
    date: str  # YYYY-MM-DD
    requested_clock_in: datetime
    requested_clock_out: datetime
    reason: str = Field(min_length=5, max_length=500)


class AttendanceCorrection(BaseModel):
    id: str = Field(default_factory=_id)
    employee_id: str
    employee_name: str
    date: str
    requested_clock_in: datetime
    requested_clock_out: datetime
    reason: str
    status: Literal["pending", "approved", "rejected"] = "pending"
    reviewed_by: Optional[str] = None
    reviewer_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)


class CorrectionReviewIn(BaseModel):
    status: Literal["approved", "rejected"]
    note: Optional[str] = None


# ---------------------------------------------------------------- LEAVE

class LeaveType(BaseModel):
    code: str
    label: str
    annual_allowance: int = 12
    is_paid: bool = True
    carry_forward: bool = False


class LeaveRequestIn(BaseModel):
    leave_type_code: str
    from_date: str  # YYYY-MM-DD
    to_date: str    # YYYY-MM-DD
    days_count: float = 1.0
    is_half_day: bool = False
    reason: str = Field(min_length=5, max_length=500)


class LeaveRequest(BaseModel):
    id: str = Field(default_factory=_id)
    employee_id: str
    employee_name: str
    employee_email: str
    manager_id: Optional[str] = None
    leave_type_code: str
    leave_type_label: str
    from_date: str
    to_date: str
    days_count: float = 1.0
    is_half_day: bool = False
    reason: str
    status: Literal["pending", "approved", "rejected", "cancelled"] = "pending"
    reviewed_by: Optional[str] = None
    reviewer_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    is_test_data: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class LeaveReviewIn(BaseModel):
    status: Literal["approved", "rejected"]
    note: Optional[str] = None


# ---------------------------------------------------------------- PAYROLL

class SalaryStructure(BaseModel):
    employee_id: str
    monthly_gross_paise: int = 3500000  # Default 35,000 INR
    basic_paise: int = 1750000
    hra_paise: int = 875000
    special_allowance_paise: int = 875000
    standard_deductions_paise: int = 0
    updated_at: datetime = Field(default_factory=utcnow)


class PayrollPeriod(BaseModel):
    id: str = Field(default_factory=_id)
    month: str  # YYYY-MM
    name: str   # e.g. "September 2026"
    status: Literal["draft", "calculated", "reviewed", "approved", "paid"] = "draft"
    working_days: int = 26
    total_gross_paise: int = 0
    total_deductions_paise: int = 0
    total_net_paise: int = 0
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    is_test_data: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class PayrollRecord(BaseModel):
    id: str = Field(default_factory=_id)
    period_id: str
    month: str
    employee_id: str
    employee_name: str
    employee_role: str = "EMPLOYEE"
    manager_id: Optional[str] = None
    working_days: int = 26
    present_days: float = 26.0
    paid_leaves: float = 0.0
    unpaid_leaves: float = 0.0
    half_days: int = 0
    absent_days: float = 0.0
    gross_salary_paise: int = 3500000
    lop_deduction_paise: int = 0
    overtime_paise: int = 0
    incentives_paise: int = 0
    deductions_paise: int = 0
    net_payable_paise: int = 3500000
    status: Literal["draft", "reviewed", "approved", "paid"] = "draft"
    notes: Optional[str] = None
    is_test_data: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PayrollAdjustIn(BaseModel):
    incentives_paise: Optional[int] = None
    deductions_paise: Optional[int] = None
    overtime_paise: Optional[int] = None
    notes: Optional[str] = None
