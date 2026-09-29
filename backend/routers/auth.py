import hashlib
import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from lib.crm_intake import capture_registration, merge_guest_history
from lib.db import db
from lib.security import (
    ADMIN,
    CART_COOKIE,
    CRM_EMPLOYEE,
    CRM_MANAGER,
    CRM_MASTER,
    MANAGER,
    OWNER,
    SESSION_COOKIE,
    STOCK_POINT_MANAGER,
    audit,
    clear_session_cookie,
    create_session,
    destroy_session,
    forgot_password_rate_limited,
    hash_password,
    login_rate_limited,
    mint_referral_code,
    normalize_email,
    now_utc,
    optional_user,
    set_session_cookie,
    verify_password,
)
from models.users import (
    AuthOut,
    ForgotPasswordVerifyIn,
    ForgotPasswordVerifyOut,
    LoginIn,
    ResetPasswordIn,
    ResetPasswordOut,
    SignupIn,
    UserOut,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def normalize_phone(raw: str) -> str:
    """Canonical representation for Indian numbers: '+91' followed by 10 digits."""
    if not raw:
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}" if digits else ""


async def unique_referral_code() -> str:
    for _ in range(10):
        code = mint_referral_code()
        if not await db.users.find_one({"referral_code": code}):
            return code
    raise HTTPException(status_code=500, detail="could not mint referral code")


async def merge_guest_cart(user_id: str, request: Request) -> int:
    """Deterministic merge: quantities sum, capped to free stock; guest cart then deleted."""
    token = request.cookies.get(CART_COOKIE)
    if not token:
        return 0
    guest = await db.carts.find_one({"token": token, "user_id": None})
    if not guest:
        return 0
    own = await db.carts.find_one({"user_id": user_id})
    merged = 0
    if own and own["id"] != guest["id"]:
        by_variant = {i["variant_id"]: i["qty"] for i in own.get("items", [])}
        for item in guest.get("items", []):
            by_variant[item["variant_id"]] = by_variant.get(item["variant_id"], 0) + item["qty"]
        new_items = []
        for vid, qty in by_variant.items():
            v = await db.variants.find_one({"id": vid, "is_active": True})
            if not v:
                continue
            cap = max(0, v["stock"] - v.get("reserved", 0))
            if cap <= 0:
                continue
            new_items.append({"variant_id": vid, "qty": min(qty, cap, 10)})
        ref_code = own.get("referred_code") or guest.get("referred_code")
        await db.carts.update_one({"id": own["id"]}, {"$set": {"items": new_items, "referred_code": ref_code}})
        await db.carts.delete_one({"id": guest["id"]})
        merged = len(new_items)
    else:
        await db.carts.update_one({"id": guest["id"]}, {"$set": {"user_id": user_id}})
        merged = len(guest.get("items", []))
    return merged


@router.get("/auth/validate-referral")
@router.post("/auth/validate-referral")
async def validate_referral_code(code: Optional[str] = Query(None), request: Request = None):
    """Authoritatively validate a referral code without exposing any PII or internal IDs."""
    target_code = code
    if not target_code and request and request.method == "POST":
        try:
            body = await request.json()
            target_code = body.get("code")
        except Exception:
            pass
    clean_code = (target_code or "").strip().upper()
    if not clean_code:
        return {"valid": False, "message": "Referral code is required"}

    owner = await db.users.find_one({"referral_code": clean_code, "is_active": True})
    if not owner:
        # Check referral_rules or affiliates collections if any
        rule = await db.referral_rules.find_one({"code": clean_code, "is_active": True})
        if not rule:
            return {"valid": False, "message": "Referral code is invalid or unavailable."}

    return {
        "valid": True,
        "code": clean_code,
        "message": "Referral code applied",
    }


@router.post("/auth/signup", response_model=AuthOut)
async def signup(input: SignupIn, request: Request, response: Response):
    email = normalize_email(str(input.email))
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="Invalid email format")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="This email is already registered. Sign in instead.")

    # Canonical phone normalization and uniqueness check
    clean_phone = normalize_phone(input.phone)
    digits = re.sub(r"\D", "", clean_phone)
    if len(digits) < 10:
        raise HTTPException(status_code=422, detail="Please enter a valid 10-digit mobile phone number")
    raw_10 = digits[2:] if digits.startswith("91") and len(digits) == 12 else digits

    phone_or_queries = [
        {"phone": clean_phone},
        {"phone": raw_10},
        {"phone": f"+91{raw_10}"},
        {"phone": f"+91 {raw_10}"},
        {"phone": f"0{raw_10}"},
        {"phone": input.phone.strip()},
    ]
    if await db.users.find_one({"$or": phone_or_queries}):
        raise HTTPException(status_code=409, detail="This phone number is already registered. Sign in instead.")

    # Authoritative MSG91 OTP verification check (never trust client-side boolean alone!)
    from lib.msg91_verifier import verify_msg91_evidence

    verified, verify_msg = await verify_msg91_evidence(
        token=input.msg91_verification_token,
        phone=clean_phone,
        req_id=input.msg91_request_id,
    )
    if not verified:
        raise HTTPException(status_code=403, detail=verify_msg)

    user_id = str(uuid.uuid4())
    referral_code = await unique_referral_code()

    # Optional referral attribution at signup:
    # 1. Manual code from input (or prefilled)
    # 2. Or from the active guest cart session token if not explicitly passed
    cart_token = request.cookies.get(CART_COOKIE)
    ref_code = (input.referral_code or "").strip().upper()
    if not ref_code and cart_token:
        guest_cart = await db.carts.find_one({"token": cart_token})
        if guest_cart and guest_cart.get("referred_code"):
            ref_code = guest_cart["referred_code"]

    referred_by = None
    if ref_code:
        owner = await db.users.find_one({"referral_code": ref_code, "is_active": True})
        if owner and owner["id"] != user_id:
            referred_by = ref_code

    user = {
        "id": user_id,
        "email": email,
        "name": input.name.strip(),
        "phone": clean_phone,
        "password_hash": hash_password(input.password),
        "roles": ["customer"],
        "referral_code": referral_code,
        "referred_by": referred_by,
        "phone_verified": True,
        "phone_verified_at": now_utc(),
        "phone_verification_provider": "MSG91",
        "is_active": True,
        "consent": {
            "agreed": True,
            "terms_and_privacy": True,
            "agreed_at": now_utc(),
            "version": "2026-v1",
        },
        "created_at": now_utc(),
    }
    await db.users.insert_one(user)


    # Safely attach/merge guest referral attribution into the customer account (no duplicate leads!)

    if referred_by:
        from lib.referral_lead_service import merge_lead_on_signup
        await merge_lead_on_signup(user_id=user_id, user=user, cart_token=cart_token, ref_code=referred_by)

    # CRM intake: exactly ONE registration lead per verified signup (idempotent on event_key).
    try:
        await capture_registration(user)
        await merge_guest_history(user_id, request.cookies.get(CART_COOKIE))
    except Exception:
        logger.exception("CRM registration intake failed for %s", user_id)

    merged = await merge_guest_cart(user_id, request)
    token = await create_session(user_id)
    set_session_cookie(response, token)
    return AuthOut(user=UserOut(**user), guest_cart_merged=merged)


@router.post("/auth/login", response_model=AuthOut)
async def login(input: LoginIn, request: Request, response: Response):
    val = (input.identifier or input.email or input.phone or "").strip()
    if not val:
        raise HTTPException(status_code=422, detail="Email or phone number is required")

    if login_rate_limited(f"{val}:{request.client.host if request.client else 'anon'}"):
        raise HTTPException(status_code=429, detail="Too many attempts — try again shortly")

    # Match either email or phone
    queries = []
    if "@" in val:
        queries.append({"email": normalize_email(val)})
    else:
        norm_phone = normalize_phone(val)
        digits = re.sub(r"\D", "", val)
        raw_10 = digits[2:] if digits.startswith("91") and len(digits) == 12 else digits
        if norm_phone:
            queries.append({"phone": norm_phone})
        queries.append({"phone": val})
        queries.append({"phone": digits})
        if len(raw_10) == 10:
            queries.append({"phone": f"+91{raw_10}"})
            queries.append({"phone": f"+91 {raw_10}"})
            queries.append({"phone": raw_10})
            queries.append({"phone": f"0{raw_10}"})
        queries.append({"email": normalize_email(val)})

    user = await db.users.find_one({"$or": queries})
    if not user or not verify_password(input.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated — contact administration")

    cart_token = request.cookies.get(CART_COOKIE)
    merged = await merge_guest_cart(user["id"], request)

    # Merge guest lead attribution into customer profile if customer has no prior attribution
    if cart_token:
        guest_lead = await db.referral_attributions.find_one({"guest_cart_token": cart_token})
        if guest_lead and not guest_lead.get("customer_id"):
            from lib.referral_lead_service import mask_email, mask_phone
            await db.referral_attributions.update_one(
                {"id": guest_lead["id"]},
                {
                    "$set": {
                        "customer_id": user["id"],
                        "customer_name": user.get("name"),
                        "customer_email_masked": mask_email(user.get("email")),
                        "customer_phone_masked": mask_phone(user.get("phone")),
                    },
                    "$push": {
                        "events": {"type": "CUSTOMER_LOGGED_IN", "at": now_utc(), "detail": "Customer logged in; guest attribution linked to user"}
                    }
                }
            )

    if not user.get("referral_code"):
        code = await unique_referral_code()
        await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": code}})
        user["referral_code"] = code

    token = await create_session(user["id"])
    set_session_cookie(response, token)
    return AuthOut(user=UserOut(**user), guest_cart_merged=merged)


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await destroy_session(token)
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/auth/me", response_model=Optional[UserOut])
async def me(user=Depends(optional_user)):
    if not user:
        return None
    if not user.get("referral_code"):
        code = await unique_referral_code()
        await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": code}})
        user["referral_code"] = code
    return UserOut(**user)


@router.post("/auth/forgot-password/verify", response_model=ForgotPasswordVerifyOut)
async def forgot_password_verify(input: ForgotPasswordVerifyIn, request: Request):
    """
    Authoritatively verify phone ownership via MSG91 for customer password recovery,
    and issue a short-lived single-use password reset authorization token.
    """
    clean_phone = normalize_phone(input.phone)
    digits = re.sub(r"\D", "", clean_phone)
    if len(digits) < 10:
        raise HTTPException(status_code=422, detail="Please enter a valid 10-digit mobile phone number")
    raw_10 = digits[2:] if digits.startswith("91") and len(digits) == 12 else digits

    client_ip = request.client.host if request.client else "anon"
    if forgot_password_rate_limited(f"fp_verify:{raw_10}:{client_ip}", limit=5, window_s=300):
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again shortly.")

    # Authoritative MSG91 OTP verification check (never trust client boolean alone)
    from lib.msg91_verifier import verify_msg91_evidence

    verified, verify_msg = await verify_msg91_evidence(
        token=input.msg91_verification_token,
        phone=clean_phone,
        req_id=input.msg91_request_id,
    )
    if not verified:
        raise HTTPException(status_code=403, detail=verify_msg)

    # Locate customer account by verified phone
    phone_or_queries = [
        {"phone": clean_phone},
        {"phone": raw_10},
        {"phone": f"+91{raw_10}"},
        {"phone": f"+91 {raw_10}"},
        {"phone": f"0{raw_10}"},
        {"phone": input.phone.strip()},
    ]
    user = await db.users.find_one({"$or": phone_or_queries})
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No customer account is registered with this phone number. Please check the number or sign up."
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated. Please contact customer support."
        )

    # Account Type Rule (Section 16): Public customer flow only, no staff/admin accounts
    user_roles = set(user.get("roles") or [])
    staff_set = {
        OWNER, ADMIN, "owner_admin", MANAGER, CRM_MASTER, "crm_master_admin",
        CRM_MANAGER, CRM_EMPLOYEE, STOCK_POINT_MANAGER, "employee"
    }
    if user_roles.intersection(staff_set):
        logger.warning(
            "Privileged staff account password reset attempted via customer portal for user %s (roles: %s)",
            user["id"],
            user_roles
        )
        raise HTTPException(
            status_code=403,
            detail="Staff and administrative accounts cannot reset passwords through the customer portal. Please contact system administration."
        )

    if "customer" not in user_roles and user_roles:
        raise HTTPException(
            status_code=403,
            detail="Only customer accounts can be reset through this portal."
        )

    # Generate short-lived, single-use, cryptographically secure password reset token
    raw_reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_reset_token.encode("utf-8")).hexdigest()
    expires_at = now_utc() + timedelta(minutes=10)

    # Invalidate previous unused reset requests for this user
    await db.password_resets.delete_many({"user_id": user["id"], "used": False})

    reset_record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "phone": clean_phone,
        "token_hash": token_hash,
        "purpose": "password_reset",
        "used": False,
        "created_at": now_utc(),
        "expires_at": expires_at,
    }
    await db.password_resets.insert_one(reset_record)

    return ForgotPasswordVerifyOut(
        ok=True,
        reset_token=raw_reset_token,
        message="Phone verified successfully. Please enter your new password."
    )


@router.post("/auth/forgot-password/reset", response_model=ResetPasswordOut)
async def forgot_password_reset(input: ResetPasswordIn, request: Request, response: Response):
    """
    Authoritatively consumes single-use reset authorization token and updates customer password.
    """
    client_ip = request.client.host if request.client else "anon"
    if forgot_password_rate_limited(f"fp_reset:{client_ip}", limit=10, window_s=300):
        raise HTTPException(status_code=429, detail="Too many reset attempts. Please try again shortly.")

    if input.new_password != input.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match.")

    if len(input.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    token_hash = hashlib.sha256(input.reset_token.strip().encode("utf-8")).hexdigest()
    reset_record = await db.password_resets.find_one({"token_hash": token_hash})
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid password reset authorization. Please start again.")

    if reset_record.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid reset authorization purpose.")

    if reset_record.get("used"):
        raise HTTPException(status_code=400, detail="This password reset authorization has already been used. Please start again.")

    expires_at = reset_record.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    elif expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not expires_at or expires_at < now_utc():
        raise HTTPException(status_code=400, detail="Your password reset session has expired. Please start again.")

    # Atomically mark as used immediately (single use protection)
    await db.password_resets.update_one(
        {"id": reset_record["id"]},
        {"$set": {"used": True, "used_at": now_utc()}}
    )

    user = await db.users.find_one({"id": reset_record["user_id"]})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=404, detail="Customer account not found or deactivated.")

    # Guard staff account again
    user_roles = set(user.get("roles") or [])
    staff_set = {
        OWNER, ADMIN, "owner_admin", MANAGER, CRM_MASTER, "crm_master_admin",
        CRM_MANAGER, CRM_EMPLOYEE, STOCK_POINT_MANAGER, "employee"
    }
    if user_roles.intersection(staff_set):
        raise HTTPException(
            status_code=403,
            detail="Staff and administrative accounts cannot reset passwords through the customer portal."
        )

    # Hash new password using existing secure hashing mechanism
    new_hash = hash_password(input.new_password)
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password_hash": new_hash,
                "password_updated_at": now_utc(),
            }
        }
    )

    # Session Security (Section 11): Invalidate all existing sessions for this customer
    await db.sessions.delete_many({"user_id": user["id"]})
    clear_session_cookie(response)

    # Audit log
    await audit(
        actor={"id": user["id"], "email": user.get("email")},
        action="PASSWORD_RESET_SUCCESS",
        entity="user",
        entity_id=user["id"],
        detail=f"Customer password successfully reset via MSG91 OTP for {user.get('email')}"
    )

    return ResetPasswordOut(
        ok=True,
        message="Your password has been updated successfully."
    )

