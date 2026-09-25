"""Identity & Staff models. Mirrored by hand in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserOut(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    phone: Optional[str] = None
    roles: List[str] = ["customer"]
    department: Optional[str] = None
    designation: Optional[str] = None
    capabilities: List[str] = []
    reporting_to: Optional[str] = None
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class SignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    phone: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    # Support Email OR Phone OR unified identifier
    identifier: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str


class AuthOut(BaseModel):
    user: UserOut
    guest_cart_merged: int = 0


class StaffCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)
    role: str = "EMPLOYEE"  # OWNER_ADMIN | CRM_MASTER_ADMIN | MANAGER | EMPLOYEE
    department: Optional[str] = "Customer Experience"
    designation: Optional[str] = "Sleep Specialist"
    reporting_to: Optional[str] = None
    capabilities: List[str] = []
    password: Optional[str] = None


class StaffUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[List[str]] = None
    role: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    reporting_to: Optional[str] = None
    capabilities: Optional[List[str]] = None
    is_active: Optional[bool] = None


class StaffInviteIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    roles: List[str] = Field(min_length=1)


class AddressIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: Optional[EmailStr] = None
    line1: str = Field(min_length=5, max_length=200)
    line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pincode: str = Field(pattern=r"^[1-9][0-9]{5}$")

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v


class AddressOut(AddressIn):
    pass
