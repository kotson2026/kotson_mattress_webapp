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
    phone_verified: bool = False
    phone_verified_at: Optional[datetime] = None
    phone_verification_provider: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class SignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    referral_code: Optional[str] = None
    consent: bool = True
    msg91_verification_token: Optional[str] = None
    msg91_request_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if len(trimmed) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return trimmed

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must agree to the Terms & Conditions and Privacy Policy.")
        return v




class ForgotPasswordVerifyIn(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    msg91_verification_token: str = Field(min_length=1)
    msg91_request_id: Optional[str] = None


class ForgotPasswordVerifyOut(BaseModel):
    ok: bool = True
    reset_token: str
    message: str = "Phone verified successfully. Please enter your new password."


class ResetPasswordIn(BaseModel):
    reset_token: str = Field(min_length=16, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)


class ResetPasswordOut(BaseModel):
    ok: bool = True
    message: str = "Your password has been updated successfully."


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
