"""Auth: email/password, httpOnly cookie sessions, referral-code minting, guest-cart merge."""

import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.crm_intake import capture_registration, merge_guest_history
from lib.db import db
from lib.security import (
    CART_COOKIE,
    SESSION_COOKIE,
    clear_session_cookie,
    create_session,
    destroy_session,
    hash_password,
    login_rate_limited,
    mint_referral_code,
    normalize_email,
    now_utc,
    optional_user,
    set_session_cookie,
    verify_password,
)
from models.users import AuthOut, LoginIn, SignupIn, UserOut

router = APIRouter()


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


@router.post("/auth/signup", response_model=AuthOut)
async def signup(input: SignupIn, request: Request, response: Response):
    email = normalize_email(str(input.email))
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=422, detail="invalid email")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

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
        "phone": input.phone.strip() if input.phone else None,
        "password_hash": hash_password(input.password),
        "roles": ["customer"],
        "referral_code": referral_code,
        "referred_by": referred_by,
        "is_active": True,
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
        clean_phone = re.sub(r"[^\d+]", "", val)
        queries.append({"phone": clean_phone})
        queries.append({"phone": val})
        if clean_phone.startswith("+91"):
            queries.append({"phone": clean_phone[3:]})
        elif len(clean_phone) == 10:
            queries.append({"phone": f"+91{clean_phone}"})
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
