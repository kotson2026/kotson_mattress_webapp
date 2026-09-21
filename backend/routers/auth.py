"""Auth: email/password, httpOnly cookie sessions, referral-code minting, guest-cart merge."""

import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response

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
        await db.carts.update_one({"id": own["id"]}, {"$set": {"items": new_items}})
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

    # Optional referral attribution at signup — a manual code may override a prefilled one
    # BEFORE signup confirmation; post-signup it is immutable.
    referred_by = None
    ref_code = (input.referral_code or "").strip().upper()
    if ref_code:
        owner = await db.users.find_one({"referral_code": ref_code, "is_active": True})
        if owner and owner["id"] != user_id:
            referred_by = ref_code
            await db.referral_attributions.update_one(
                {"customer_id": user_id},
                {
                    "$set": {"code": ref_code, "source": "signup", "owner_user_id": owner["id"]},
                    "$setOnInsert": {"created_at": now_utc()},
                },
                upsert=True,
            )

    user = {
        "id": user_id,
        "email": email,
        "name": input.name.strip(),
        "password_hash": hash_password(input.password),
        "roles": ["customer"],
        "referral_code": referral_code,
        "referred_by": referred_by,
        "is_active": True,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user)

    merged = await merge_guest_cart(user_id, request)
    token = await create_session(user_id)
    set_session_cookie(response, token)
    return AuthOut(user=UserOut(**user), guest_cart_merged=merged)


@router.post("/auth/login", response_model=AuthOut)
async def login(input: LoginIn, request: Request, response: Response):
    email = normalize_email(str(input.email))
    if login_rate_limited(f"{email}:{request.client.host if request.client else 'anon'}"):
        raise HTTPException(status_code=429, detail="Too many attempts — try again shortly")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated — contact support")

    merged = await merge_guest_cart(user["id"], request)
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
    return UserOut(**user) if user else None
