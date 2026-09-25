"""Coupon system — server-side validation, single-use tracking, stacking rules.

Stacking rule (production-safe default):
  Coupons DO NOT stack with the global 40% promotion unless the coupon
  record explicitly sets stackable_with_global_promo=True.

All validation is server-authoritative. Frontend never computes final amounts.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.db import db
from lib.pricing import get_active_promotion
from lib.security import now_utc, optional_user

router = APIRouter()
logger = logging.getLogger(__name__)


class CouponApplyIn(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    cart_subtotal_paise: int = Field(ge=0)  # current cart subtotal in paise


class CouponResult(BaseModel):
    valid: bool
    code: str
    discount_paise: int = 0
    discount_type: str = "none"        # percentage | fixed | none
    discount_value: float = 0.0
    stackable_with_global_promo: bool = False
    message: str = ""
    coupon_id: Optional[str] = None


@router.post("/checkout/apply-coupon", response_model=CouponResult)
async def apply_coupon(input: CouponApplyIn, user=Depends(optional_user)):
    """Validate a coupon code server-side and return the discount amount."""
    code = input.code.strip().upper()

    coupon = await db.coupons.find_one({"code": code, "is_active": True})
    if not coupon:
        return CouponResult(valid=False, code=code, message="Coupon code not found or expired")

    now = now_utc()

    # Date validity
    valid_from = coupon.get("valid_from")
    valid_until = coupon.get("valid_until")
    if valid_from and valid_from.replace(tzinfo=timezone.utc) > now:
        return CouponResult(valid=False, code=code, message="This coupon is not yet active")
    if valid_until and valid_until.replace(tzinfo=timezone.utc) < now:
        return CouponResult(valid=False, code=code, message="This coupon has expired")

    # Usage limit
    usage_limit = coupon.get("usage_limit")
    used_count = coupon.get("used_count", 0)
    if usage_limit and used_count >= usage_limit:
        return CouponResult(valid=False, code=code, message="This coupon has reached its usage limit")

    # Minimum order value
    min_order = coupon.get("min_order_value_paise", 0)
    if input.cart_subtotal_paise < min_order:
        min_rupees = min_order // 100
        return CouponResult(valid=False, code=code, message=f"Minimum order value of ₹{min_rupees:,} required for this coupon")

    # Stacking check: does a global promotion exist?
    promo = await get_active_promotion()
    global_promo_active = promo.get("enabled", False) and promo.get("discount_percent", 0) > 0
    stackable = bool(coupon.get("stackable_with_global_promo", False))

    if global_promo_active and not stackable:
        return CouponResult(
            valid=False, code=code,
            message="This coupon cannot be combined with the current sitewide 40% sale"
        )

    # Calculate discount
    discount_paise = 0
    discount_type = coupon.get("type", "percentage")
    discount_value = float(coupon.get("value", 0))

    if discount_type == "percentage":
        discount_paise = round(input.cart_subtotal_paise * discount_value / 100)
        max_discount = coupon.get("max_discount_paise")
        if max_discount:
            discount_paise = min(discount_paise, max_discount)
    elif discount_type == "fixed":
        discount_paise = min(int(discount_value * 100), input.cart_subtotal_paise)

    return CouponResult(
        valid=True,
        code=code,
        discount_paise=discount_paise,
        discount_type=discount_type,
        discount_value=discount_value,
        stackable_with_global_promo=stackable,
        message=f"Coupon applied — you save ₹{discount_paise // 100:,}",
        coupon_id=coupon["id"],
    )


@router.get("/checkout/coupons")
async def list_active_coupons():
    """Return publicly visible active coupons (for 'View Coupons' UI)."""
    now = now_utc()
    query: dict = {
        "is_active": True,
        "is_public": True,
        "$or": [
            {"valid_until": None},
            {"valid_until": {"$gt": now}},
        ],
    }
    docs = await db.coupons.find(query).sort("sort", 1).to_list(20)
    return [
        {
            "code": d["code"],
            "description": d.get("description", ""),
            "type": d.get("type", "percentage"),
            "value": d.get("value", 0),
            "min_order_value_paise": d.get("min_order_value_paise", 0),
        }
        for d in docs
    ]
