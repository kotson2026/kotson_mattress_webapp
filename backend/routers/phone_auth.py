"""OTP phone verification + saved address management.

OTP delivery: console/log mode (owner plugs in SMS provider via SMS_PROVIDER env var).
Supported SMS_PROVIDER values: 'console' (default), 'msg91', 'twilio'.

Phone canonicalization: last 10 digits of stripped-digit string, stored as '9876543210'.
Never stores +91 prefix in the database — normalisation runs on every lookup.

Security model:
  - OTPs expire after OTP_TTL_MINUTES (default 10)
  - Max OTP_MAX_ATTEMPTS (default 3) verification attempts per OTP record
  - After exhaustion, the OTP is dead — customer must request a new one
  - OTP session token is issued after successful verification; valid for 30 min
  - All address CRUD requires either (a) full session cookie or (b) valid otp_session_token
  - Address records are keyed to customer_id (resolved from phone) — never raw phone
  - IDOR prevented: /addresses only returns records owned by the verified customer
"""

import logging
import os
import random
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import now_utc, optional_user, require_user

router = APIRouter()
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────
OTP_TTL_MINUTES = int(os.environ.get("OTP_TTL_MINUTES", "10"))
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", "3"))
OTP_SESSION_TTL_MINUTES = int(os.environ.get("OTP_SESSION_TTL_MINUTES", "30"))
SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "console").lower()
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "")


# ──────────────────────────────────────────────────────────
# Phone normalisation
# ──────────────────────────────────────────────────────────
def normalize_phone(raw: str) -> Optional[str]:
    """Returns last-10-digit canonical form or None if invalid."""
    import re
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 10:
        return None
    last10 = digits[-10:]
    if not last10[0].isdigit() or last10[0] == "0":
        return None
    return last10


# ──────────────────────────────────────────────────────────
# OTP generation & delivery
# ──────────────────────────────────────────────────────────
def generate_otp() -> str:
    return f"{random.SystemRandom().randint(100000, 999999)}"


async def deliver_otp(phone_canonical: str, otp: str) -> None:
    """Deliver OTP via configured provider. Console mode: logs to terminal."""
    display = f"+91{phone_canonical}"
    if SMS_PROVIDER == "msg91" and MSG91_AUTH_KEY and MSG91_TEMPLATE_ID:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    "https://api.msg91.com/api/v5/otp",
                    json={
                        "authkey": MSG91_AUTH_KEY,
                        "template_id": MSG91_TEMPLATE_ID,
                        "mobile": display,
                        "otp": otp,
                    },
                )
            if r.status_code == 200:
                logger.info("OTP sent via MSG91 to %s", display)
                return
            logger.warning("MSG91 delivery failed: %s %s", r.status_code, r.text[:200])
        except Exception as exc:
            logger.warning("MSG91 delivery error: %s — falling back to console", exc)

    elif SMS_PROVIDER == "twilio" and TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM:
        try:
            import httpx
            from base64 import b64encode
            creds = b64encode(f"{TWILIO_SID}:{TWILIO_TOKEN}".encode()).decode()
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                    headers={"Authorization": f"Basic {creds}"},
                    data={
                        "From": TWILIO_FROM,
                        "To": display,
                        "Body": f"Your Kotson verification code is {otp}. Valid for {OTP_TTL_MINUTES} minutes.",
                    },
                )
            if r.status_code in (200, 201):
                logger.info("OTP sent via Twilio to %s", display)
                return
            logger.warning("Twilio delivery failed: %s %s", r.status_code, r.text[:200])
        except Exception as exc:
            logger.warning("Twilio delivery error: %s — falling back to console", exc)

    # Console mode (default / fallback)
    logger.warning(
        "╔══════════════════════════════════════════════════════╗\n"
        "║  KOTSON OTP (CONSOLE MODE — NOT SENT VIA SMS)       ║\n"
        "║  Phone : %-44s  ║\n"
        "║  OTP   : %-44s  ║\n"
        "║  TTL   : %d minutes                                  ║\n"
        "╚══════════════════════════════════════════════════════╝",
        display, otp, OTP_TTL_MINUTES,
    )


# ──────────────────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────────────────
class OtpSendIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15)


class OtpVerifyIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    otp: str = Field(min_length=4, max_length=8)


class SavedAddressIn(BaseModel):
    label: str = Field(default="Home", max_length=32)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=15)
    email: Optional[str] = Field(default=None, max_length=200)
    line1: str = Field(min_length=5, max_length=200)
    line2: Optional[str] = Field(default=None, max_length=200)
    landmark: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    pincode: str = Field(pattern=r"^[1-9][0-9]{5}$")
    is_default: bool = False


class SavedAddressOut(SavedAddressIn):
    id: str
    customer_id: str
    created_at: datetime
    updated_at: datetime


class OtpSessionInfo(BaseModel):
    otp_token: str
    phone: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    is_new_customer: bool = False


# ──────────────────────────────────────────────────────────
# OTP session token helper
# ──────────────────────────────────────────────────────────
async def get_verified_identity(
    otp_token: Optional[str] = None,
    session_user=None,
) -> dict:
    """Returns {customer_id, phone} from either a full session or a valid OTP token."""
    if session_user:
        canon_phone = normalize_phone(session_user.get("phone", "") or "")
        return {"customer_id": session_user["id"], "phone": canon_phone}
    if not otp_token:
        raise HTTPException(status_code=401, detail="Authentication required — provide session or OTP token")
    record = await db.otp_sessions.find_one({"token": otp_token})
    if not record:
        raise HTTPException(status_code=401, detail="OTP session not found or expired — verify your mobile number first")
    if record["expires_at"].replace(tzinfo=timezone.utc) < now_utc():
        await db.otp_sessions.delete_one({"token": otp_token})
        raise HTTPException(status_code=401, detail="OTP session expired — verify your mobile number again")
    return {"customer_id": record["customer_id"], "phone": record["phone"]}


# ──────────────────────────────────────────────────────────
# OTP endpoints
# ──────────────────────────────────────────────────────────
@router.post("/auth/otp/send")
async def otp_send(input: OtpSendIn, request: Request):
    """Request an OTP for phone verification. Rate-limited per phone."""
    canon = normalize_phone(input.phone)
    if not canon:
        raise HTTPException(status_code=422, detail="Please enter a valid 10-digit Indian mobile number")

    # Simple in-process rate limit: max 5 OTP requests per phone per hour
    one_hour_ago = now_utc() - timedelta(hours=1)
    recent_count = await db.otps.count_documents({
        "phone": canon,
        "created_at": {"$gte": one_hour_ago},
    })
    if recent_count >= 5:
        raise HTTPException(status_code=429, detail="Too many OTP requests for this number — try again after an hour")

    otp_code = generate_otp()
    otp_doc = {
        "id": str(uuid.uuid4()),
        "phone": canon,
        "code": otp_code,
        "attempts": 0,
        "used": False,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=OTP_TTL_MINUTES),
    }
    await db.otps.insert_one(otp_doc)
    await deliver_otp(canon, otp_code)
    return {
        "ok": True,
        "phone": f"+91{canon}",
        "expires_in_minutes": OTP_TTL_MINUTES,
        "mode": SMS_PROVIDER,
    }


@router.post("/auth/otp/verify", response_model=OtpSessionInfo)
async def otp_verify(input: OtpVerifyIn):
    """Verify the OTP. Returns an OTP session token scoped to the verified phone."""
    canon = normalize_phone(input.phone)
    if not canon:
        raise HTTPException(status_code=422, detail="Invalid mobile number format")

    # Find most recent unused, unexpired OTP for this phone
    otp_record = await db.otps.find_one(
        {"phone": canon, "used": False, "expires_at": {"$gt": now_utc()}},
        sort=[("created_at", -1)],
    )
    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP has expired or does not exist — please request a new one")

    if otp_record["attempts"] >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail=f"OTP attempt limit reached ({OTP_MAX_ATTEMPTS} tries) — request a new code")

    # Increment attempt counter atomically
    await db.otps.update_one({"id": otp_record["id"]}, {"$inc": {"attempts": 1}})

    # Constant-time comparison
    import hmac
    if not hmac.compare_digest(otp_record["code"], input.otp.strip()):
        remaining = OTP_MAX_ATTEMPTS - (otp_record["attempts"] + 1)
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP — {remaining} attempt{'s' if remaining != 1 else ''} remaining"
        )

    # Mark OTP as used (single-use)
    await db.otps.update_one({"id": otp_record["id"]}, {"$set": {"used": True}})

    # Resolve or create customer record for this phone
    existing_user = await db.users.find_one({"phone": canon})
    if not existing_user:
        # Also try +91 prefix variants for legacy records
        existing_user = await db.users.find_one({"phone": f"+91{canon}"})

    is_new = False
    if existing_user:
        customer_id = existing_user["id"]
    else:
        # Create a minimal guest customer record — enriched when address is added
        customer_id = str(uuid.uuid4())
        guest_user = {
            "id": customer_id,
            "email": None,
            "name": f"Customer {canon[-4:]}",
            "phone": canon,
            "password_hash": None,
            "roles": ["customer"],
            "referral_code": None,
            "referred_by": None,
            "is_active": True,
            "is_phone_only": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(guest_user)
        is_new = True
        existing_user = guest_user

    # Issue OTP session token
    token = secrets.token_urlsafe(32)
    await db.otp_sessions.insert_one({
        "token": token,
        "phone": canon,
        "customer_id": customer_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=OTP_SESSION_TTL_MINUTES),
    })

    return OtpSessionInfo(
        otp_token=token,
        phone=f"+91{canon}",
        customer_id=customer_id,
        customer_name=existing_user.get("name") if not is_new else None,
        customer_email=existing_user.get("email"),
        is_new_customer=is_new,
    )


# ──────────────────────────────────────────────────────────
# Saved addresses (requires OTP token OR session cookie)
# ──────────────────────────────────────────────────────────
async def _require_customer(
    otp_token: Optional[str] = None,
    user=Depends(optional_user),
) -> dict:
    return await get_verified_identity(otp_token=otp_token, session_user=user)


@router.get("/addresses", response_model=List[SavedAddressOut])
async def list_addresses(
    otp_token: Optional[str] = None,
    user=Depends(optional_user),
):
    """List saved addresses for the verified customer."""
    identity = await get_verified_identity(otp_token=otp_token, session_user=user)
    docs = await db.addresses.find(
        {"customer_id": identity["customer_id"], "deleted": {"$ne": True}}
    ).sort("is_default", -1).to_list(20)
    return [SavedAddressOut(**{**d, "id": d["id"]}) for d in docs]


@router.post("/addresses", response_model=SavedAddressOut)
async def create_address(
    input: SavedAddressIn,
    otp_token: Optional[str] = None,
    user=Depends(optional_user),
):
    """Save a new delivery address."""
    identity = await get_verified_identity(otp_token=otp_token, session_user=user)
    customer_id = identity["customer_id"]

    # If new address is_default, unset all other defaults
    if input.is_default:
        await db.addresses.update_many(
            {"customer_id": customer_id},
            {"$set": {"is_default": False}},
        )
    else:
        # Make first address default automatically
        existing_count = await db.addresses.count_documents({"customer_id": customer_id, "deleted": {"$ne": True}})
        if existing_count == 0:
            input = input.model_copy(update={"is_default": True})

    now = now_utc()
    doc = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        **input.model_dump(),
        "deleted": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.addresses.insert_one(doc)
    return SavedAddressOut(**doc)


@router.put("/addresses/{address_id}", response_model=SavedAddressOut)
async def update_address(
    address_id: str,
    input: SavedAddressIn,
    otp_token: Optional[str] = None,
    user=Depends(optional_user),
):
    identity = await get_verified_identity(otp_token=otp_token, session_user=user)
    addr = await db.addresses.find_one({"id": address_id, "customer_id": identity["customer_id"], "deleted": {"$ne": True}})
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if input.is_default:
        await db.addresses.update_many({"customer_id": identity["customer_id"]}, {"$set": {"is_default": False}})
    update_data = {**input.model_dump(), "updated_at": now_utc()}
    await db.addresses.update_one({"id": address_id}, {"$set": update_data})
    updated = {**addr, **update_data}
    return SavedAddressOut(**updated)


@router.delete("/addresses/{address_id}")
async def delete_address(
    address_id: str,
    otp_token: Optional[str] = None,
    user=Depends(optional_user),
):
    identity = await get_verified_identity(otp_token=otp_token, session_user=user)
    addr = await db.addresses.find_one({"id": address_id, "customer_id": identity["customer_id"]})
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.addresses.update_one({"id": address_id}, {"$set": {"deleted": True, "updated_at": now_utc()}})
    return {"ok": True}
