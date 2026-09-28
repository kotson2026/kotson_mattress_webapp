"""Persistent server-authoritative referral attribution and lead journey service.

Implements the end-to-end Referral Lead -> Sale -> Commission workflow:
- Click tracking with visit recording (clicks do NOT inflate leads)
- Lead qualification on meaningful actions (eligible cart add or account creation)
- Single Lead - Multiple Events lifecycle (Lead -> Cart Active -> Checkout Started -> Payment Cancelled/Failed -> Converted Sale)
- Safe guest-to-registered customer merge without losing attribution or duplicating leads
- Anti-hijacking attribution policy (first_touch vs last_touch)
- Privacy-safe masking for referrer visibility
"""

import logging
import re
import uuid
from typing import Optional, Tuple

from lib.db import db
from lib.security import now_utc

logger = logging.getLogger(__name__)


def mask_email(email: Optional[str]) -> str:
    """Mask email for privacy-safe display: gk****@example.com."""
    if not email or "@" not in email:
        return "—"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "****" if local else "****"
    else:
        masked_local = local[:2] + "****" + local[-1]
    return f"{masked_local}@{domain}"


def mask_phone(phone: Optional[str]) -> str:
    """Mask phone for privacy-safe display: +91 9876****10."""
    if not phone:
        return "—"
    clean = re.sub(r"[^\d+]", "", phone)
    if len(clean) >= 8:
        return f"{clean[:5]}****{clean[-2:]}"
    return f"{clean[:2]}****"


async def get_referral_settings_cached() -> dict:
    """Fetch referral engine settings."""
    sett = await db.referral_settings.find_one({"id": "referral_settings"})
    if not sett:
        sett = {
            "id": "referral_settings",
            "attribution_policy": "first_touch",  # first_touch or last_touch
            "attribution_ttl_days": 90,
            "allow_self_referral": False,
        }
    return sett


async def record_referral_click(
    code: str,
    path: str = "/",
    cart_token: Optional[str] = None,
    user_id: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[bool, Optional[str], Optional[dict]]:
    """Server-authoritative referral link entry validation and visit recording.
    
    Validates:
    - Code exists
    - Referrer exists and is active
    - Self-referral prevention
    - Attribution policy (protects against silent hijacking under first_touch)
    
    Returns: (is_valid, error_reason, referrer_info)
    """
    clean_code = (code or "").strip().upper()
    if not clean_code:
        return False, "Referral code is required", None

    referrer = await db.users.find_one({"referral_code": clean_code, "is_active": True})
    if not referrer:
        return False, "Referral code not found or inactive", None

    settings = await get_referral_settings_cached()

    # Self-referral check if customer is already authenticated
    if user_id and not settings.get("allow_self_referral", False):
        if referrer["id"] == user_id:
            return False, "You cannot use your own referral code", None

    # Anti-hijacking check under first_touch policy
    policy = settings.get("attribution_policy", "first_touch")
    if cart_token:
        cart = await db.carts.find_one({"token": cart_token})
        if cart and cart.get("referred_code") and cart["referred_code"] != clean_code:
            if policy == "first_touch":
                logger.info(
                    "First-touch policy: Preserving existing cart attribution %s over %s",
                    cart["referred_code"], clean_code
                )
                return True, None, {"code": cart["referred_code"], "owner_id": referrer["id"]}

    # Record touch / visit (analytics only - does NOT create a lead!)
    try:
        click_doc = {
            "id": f"clk_{uuid.uuid4().hex[:12]}",
            "code": clean_code,
            "path": path or "/",
            "cart_token": cart_token,
            "user_id": user_id,
            "ip": ip,
            "user_agent": user_agent,
            "created_at": now_utc(),
        }
        await db.referral_clicks.insert_one(click_doc)
    except Exception as exc:
        logger.warning("Could not record referral click: %s", exc)

    # Link code to cart session if cart exists
    if cart_token:
        await db.carts.update_one({"token": cart_token}, {"$set": {"referred_code": clean_code}})

    return True, None, {
        "code": clean_code,
        "owner_id": referrer["id"],
        "referrer_name": referrer.get("name", "Kotson Referrer"),
    }


async def qualify_or_update_lead(
    code: Optional[str],
    event_type: str,
    cart_token: Optional[str] = None,
    user_id: Optional[str] = None,
    user: Optional[dict] = None,
    detail: Optional[str] = None,
    order_doc: Optional[dict] = None,
    metadata: Optional[dict] = None,
    **kwargs,
) -> Optional[dict]:
    """Authoritative Lead Journey State Machine.
    
    A referral lead is qualified upon meaningful action (cart add or account creation).
    Maintains ONE lead document per person/session across multiple journey events:
    LEAD -> CART_ACTIVE -> CHECKOUT_STARTED -> PAYMENT_CANCELLED -> CONVERTED.
    """
    clean_code = (code or "").strip().upper()
    if not clean_code and order_doc:
        clean_code = (order_doc.get("referral_code") or "").strip().upper()

    # Search for an existing lead for this person/session
    existing_lead = None
    if user_id:
        existing_lead = await db.referral_attributions.find_one({"customer_id": user_id})
    if not existing_lead and cart_token:
        existing_lead = await db.referral_attributions.find_one({"guest_cart_token": cart_token})
    if not existing_lead and order_doc:
        if order_doc.get("user_id"):
            existing_lead = await db.referral_attributions.find_one({"customer_id": order_doc["user_id"]})
        if not existing_lead and order_doc.get("cart_token"):
            existing_lead = await db.referral_attributions.find_one({"guest_cart_token": order_doc["cart_token"]})

    now_str = now_utc()
    event_entry = {
        "type": event_type,
        "at": now_str,
        "detail": detail or f"Lead updated with {event_type}",
    }
    if metadata:
        event_entry["metadata"] = metadata

    if existing_lead:
        # Update existing lead journey (DO NOT duplicate!)
        update_fields: dict = {
            "updated_at": now_str,
            "last_activity_type": event_type.replace("_", " ").title(),
            "last_activity_at": now_str,
        }

        # Merge user if newly identified
        if user_id and not existing_lead.get("customer_id"):
            update_fields["customer_id"] = user_id
        if user:
            if user.get("name") and not existing_lead.get("customer_name"):
                update_fields["customer_name"] = user["name"]
            if user.get("email"):
                update_fields["customer_email_masked"] = mask_email(user["email"])
            if user.get("phone"):
                update_fields["customer_phone_masked"] = mask_phone(user["phone"])

        # State transition handling
        if event_type in ("ORDER_PAID", "CONVERTED"):
            update_fields["status"] = "CONVERTED"
            update_fields["converted"] = True
            update_fields["converted_at"] = now_str
            update_fields["commission_status"] = "PENDING"
            if order_doc:
                order_num = order_doc.get("order_number")
                order_total = round(order_doc.get("amounts", {}).get("total", 0) / 100.0, 2)
                update_fields["order_number"] = order_num
                update_fields["order_id"] = order_doc.get("id")
                # Append order number to orders list without duplicating
                current_orders = existing_lead.get("orders") or []
                if order_num and order_num not in current_orders:
                    current_orders.append(order_num)
                update_fields["orders"] = current_orders
                current_sale_val = float(existing_lead.get("sale_value") or 0.0)
                update_fields["sale_value"] = round(current_sale_val + order_total, 2)
        elif event_type in ("PAYMENT_CANCELLED", "PAYMENT_FAILED"):
            # Crucial: Cancelled or failed payment MUST NOT destroy lead or attribution!
            # Keeps lead intact with status updated for reporting
            update_fields["status"] = event_type
        elif event_type == "CHECKOUT_STARTED":
            if existing_lead.get("status") != "CONVERTED":
                update_fields["status"] = "CHECKOUT_STARTED"
        elif event_type in ("CART_ACTIVE", "PRODUCT_ADDED_TO_CART"):
            if existing_lead.get("status") not in ("CHECKOUT_STARTED", "CONVERTED"):
                update_fields["status"] = "CART_ACTIVE"
        elif event_type == "ACCOUNT_CREATED":
            if existing_lead.get("status") not in ("CHECKOUT_STARTED", "CONVERTED"):
                update_fields["status"] = "ACCOUNT_CREATED"

        await db.referral_attributions.update_one(
            {"id": existing_lead["id"]},
            {
                "$set": update_fields,
                "$push": {"events": event_entry},
            },
        )
        return await db.referral_attributions.find_one({"id": existing_lead["id"]})

    # Lead does not exist yet: qualify new lead if clean_code is valid
    if not clean_code:
        return None

    referrer = await db.users.find_one({"referral_code": clean_code, "is_active": True})
    if not referrer:
        return None

    # Prevent self-referral
    if user_id and referrer["id"] == user_id:
        return None

    # Mint formatted lead reference e.g. REF-1042
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    lead_ref = f"REF-{uuid.uuid4().hex[:5].upper()}"

    initial_status = event_type
    if event_type == "PRODUCT_ADDED_TO_CART":
        initial_status = "CART_ACTIVE"

    new_lead = {
        "id": lead_id,
        "lead_number": lead_ref,
        "code": clean_code,
        "owner_user_id": referrer["id"],
        "customer_id": user_id,
        "guest_cart_token": cart_token,
        "customer_name": user.get("name") if user else "Referred Customer",
        "customer_email_masked": mask_email(user.get("email")) if user else "—",
        "customer_phone_masked": mask_phone(user.get("phone")) if user else "—",
        "source": "signup" if event_type == "ACCOUNT_CREATED" else "cart_activity",
        "status": initial_status,
        "converted": False,
        "converted_at": None,
        "orders": [],
        "order_number": None,
        "order_id": None,
        "sale_value": 0.0,
        "commission_status": "NONE",
        "events": [event_entry],
        "last_activity_type": event_type.replace("_", " ").title(),
        "last_activity_at": now_str,
        "created_at": now_str,
        "updated_at": now_str,
    }

    try:
        await db.referral_attributions.insert_one(new_lead)
        logger.info(
            "Created qualified referral lead %s (%s) for referrer %s (code %s) on %s",
            lead_id, lead_ref, referrer["id"], clean_code, event_type
        )
        return new_lead
    except Exception as exc:
        logger.warning("Could not insert referral lead: %s", exc)
        return None


async def merge_lead_on_signup(
    user_id: str,
    user: dict,
    cart_token: Optional[str],
    ref_code: Optional[str] = None,
) -> Optional[dict]:
    """Safely attach/merge valid guest referral attribution upon account creation without duplicating."""
    clean_code = (ref_code or "").strip().upper() or None

    # Check if guest cart already had a lead
    lead = await qualify_or_update_lead(
        code=clean_code,
        event_type="ACCOUNT_CREATED",
        cart_token=cart_token,
        user_id=user_id,
        user=user,
        detail="Account created; guest attribution safely linked to customer profile",
    )

    # Ensure cart has referred_code set if lead exists
    if lead and lead.get("code") and cart_token:
        await db.carts.update_one(
            {"token": cart_token},
            {"$set": {"referred_code": lead["code"]}}
        )

    return lead


async def track_payment_cancelled(
    order_id: Optional[str] = None,
    order_number: Optional[str] = None,
    cart_token: Optional[str] = None,
    reason: str = "Payment modal closed / dismissed",
    **kwargs,
) -> bool:
    """Record payment cancellation on referral lead without deleting lead or attribution."""
    order = None
    if order_id:
        order = await db.orders.find_one({"id": order_id})
    if not order and order_number:
        order = await db.orders.find_one({"order_number": order_number})

    ref_code = order.get("referral_code") if order else None
    if not ref_code and cart_token:
        lead = await db.referral_attributions.find_one({"guest_cart_token": cart_token})
        if lead:
            ref_code = lead.get("code")

    if order:
        await db.orders.update_one(
            {"id": order["id"]},
            {"$push": {"events": {"at": now_utc(), "type": "payment_cancelled", "detail": reason, "actor": "user"}}},
        )

    if ref_code:
        # Update lead status to PAYMENT_CANCELLED
        await qualify_or_update_lead(
            code=ref_code,
            event_type="PAYMENT_CANCELLED",
            cart_token=cart_token or (order.get("cart_token") if order else None),
            user_id=order.get("user_id") if order else None,
            detail=f"Payment attempt cancelled: {reason}",
            order_doc=order,
        )
        logger.info("Payment cancelled for referral order %s; lead retained in PAYMENT_CANCELLED state", order_id or order_number)
    return True
