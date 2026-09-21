"""Identity models. Mirrored by hand in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserOut(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    roles: List[str] = ["customer"]
    referral_code: Optional[str] = None
    referred_by: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class SignupIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    referral_code: Optional[str] = None  # prefilled from ?ref= or manual, before signup confirmation


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthOut(BaseModel):
    user: UserOut
    guest_cart_merged: int = 0


class StaffInviteIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    roles: List[str] = Field(min_length=1)


class StaffUpdateIn(BaseModel):
    roles: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AddressIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: EmailStr
    line1: str = Field(min_length=5, max_length=200)
    line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pincode: str = Field(pattern=r"^[1-9][0-9]{5}$")


class AddressOut(AddressIn):
    pass
