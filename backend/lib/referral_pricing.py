"""Authoritative Product-Level Referral & Commission Engine.
- Resolves product-specific commission and customer discount rules
- Computes mixed cart discounts per line independently
- Handles quantity semantics (per-unit vs per-line)
- Supports stacking policies with catalog promotions
- Enforces financial safety: line total and order total never < 0
- Snapshots rules at checkout and idempotently records line-level commissions upon verified payment
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from lib.db import db
from lib.security import now_utc

logger = logging.getLogger(__name__)


async def get_referral_settings() -> dict:
    sett = await db.settings.find_one({"id": "referral_settings"})
    if not sett:
        sett = {
            "id": "referral_settings",
            "allow_promotion_stacking": True,
            "promotion_stacking_mode": "combine",  # combine | better_discount | exclusive
            "coupon_stacking_mode": "disallow",     # allow | disallow | better_discount
            "commission_price_basis": "selling_price",  # selling_price | net_price
            "flat_quantity_semantics": "per_unit",   # per_unit | per_line
            "allow_self_referral": False,
            "attribution_ttl_days": 90,
            "updated_at": now_utc(),
        }
    return sett


async def resolve_product_rule(product_id: str, now_dt: Optional[datetime] = None) -> Optional[dict]:
    """Find the active referral rule for a specific product ID."""
    if not product_id:
        return None
    if not now_dt:
        now_dt = datetime.now(timezone.utc)
    today_str = now_dt.strftime("%Y-%m-%d")

    # Match rules where product_id is in product_ids array OR matches product_id
    query = {
        "is_active": True,
        "$or": [
            {"product_ids": product_id},
            {"product_id": product_id},
        ],
    }
    rules = await db.referral_rules.find(query).sort("created_at", -1).to_list(20)

    for r in rules:
        # Check validity window
        eff_from = r.get("effective_from")
        eff_until = r.get("effective_until")
        if eff_from and today_str < eff_from:
            continue
        if eff_until and today_str > eff_until:
            continue
        return r

    # Fallback to Global Tier rule (product_id is None or global)
    global_query = {
        "is_active": True,
        "$or": [
            {"product_id": None, "product_ids": {"$in": [None, []]}},
            {"product_id": None, "product_ids": {"$exists": False}},
            {"product_id": {"$exists": False}, "product_ids": {"$exists": False}},
            {"is_global": True},
        ],
    }
    global_rules = await db.referral_rules.find(global_query).sort("created_at", -1).to_list(10)
    for r in global_rules:
        eff_from = r.get("effective_from")
        eff_until = r.get("effective_until")
        if eff_from and today_str < eff_from:
            continue
        if eff_until and today_str > eff_until:
            continue
        return r

    return None


async def evaluate_product_referrals(
    cart_items: List[Any],
    referral_code: Optional[str],
    user: Optional[dict] = None,
    now_dt: Optional[datetime] = None,
) -> dict:
    """Evaluate product-level referral discounts and potential commissions across all cart items.
    
    Returns:
        {
            "referred_code": str or None,
            "referral_status": "none" | "valid" | "invalid" | "self",
            "referral_discount": int (paise),
            "referral_note": str,
            "lines_meta": { variant_id: line_breakdown_dict },
            "breakdown": [ line_breakdown_dict, ... ]
        }
    """
    out = {
        "referred_code": referral_code,
        "referral_status": "none",
        "referral_discount": 0,
        "referral_note": "",
        "lines_meta": {},
        "breakdown": [],
    }

    if not referral_code:
        return out

    clean_code = referral_code.strip().upper()
    out["referred_code"] = clean_code

    settings = await get_referral_settings()

    # 1. Authoritative Referrer Validation
    owner = await db.users.find_one({"referral_code": clean_code, "is_active": True})
    if not owner:
        out["referral_status"] = "invalid"
        out["referral_note"] = "This referral code was not found."
        return out

    # 2. Self-referral protection
    if user and str(owner.get("id")) == str(user.get("id")) and not settings.get("allow_self_referral"):
        out["referral_status"] = "self"
        out["referral_note"] = "You cannot use your own referral code."
        return out

    if not now_dt:
        now_dt = datetime.now(timezone.utc)

    total_discount_paise = 0
    lines_meta = {}
    breakdown = []

    # 3. Line-by-line product evaluation
    for item in cart_items:
        # Support dict or CartLine
        if isinstance(item, dict):
            variant_id = item.get("variant_id", "")
            product_id = item.get("product_id", "")
            product_name = item.get("product_name", "")
            unit_price = int(item.get("unit_price", 0))  # selling price in paise
            qty = int(item.get("qty", 1))
            line_total = int(item.get("line_total", unit_price * qty))
            is_custom = bool(item.get("is_custom"))
            custom_pricing_status = item.get("custom_pricing_status")
        else:
            variant_id = getattr(item, "variant_id", "")
            product_id = getattr(item, "product_id", "")
            product_name = getattr(item, "product_name", "")
            unit_price = int(getattr(item, "unit_price", 0))
            qty = int(getattr(item, "qty", 1))
            line_total = int(getattr(item, "line_total", unit_price * qty))
            is_custom = bool(getattr(item, "is_custom", False))
            custom_pricing_status = getattr(item, "custom_pricing_status", None)

        item_key = variant_id or product_id

        # Skip customizable products under custom quote workflow
        if is_custom and custom_pricing_status == "price_on_request":
            lines_meta[item_key] = {
                "variant_id": variant_id,
                "product_id": product_id,
                "product_name": product_name,
                "referral_eligible": False,
                "referral_discount": 0,
                "commission_amount": 0,
                "reason": "Customizable product awaiting manual quote",
            }
            continue

        # Look up product-specific rule
        rule = await resolve_product_rule(product_id, now_dt)

        if not rule:
            # Non-eligible product in mixed cart
            lines_meta[item_key] = {
                "variant_id": variant_id,
                "product_id": product_id,
                "product_name": product_name,
                "referral_eligible": False,
                "referral_discount": 0,
                "commission_amount": 0,
            }
            continue

        # Rule exists: calculate customer discount
        raw_disc_type = (rule.get("discount_type") or rule.get("reward_type") or "PERCENTAGE").upper()
        disc_type = "PERCENTAGE" if "PERCENT" in raw_disc_type else "FLAT"
        disc_val = float(rule.get("discount_value") if rule.get("discount_value") is not None else rule.get("value", 0.0))
        disc_calc = rule.get("discount_calc_type") or settings.get("flat_quantity_semantics", "per_unit")

        line_discount_paise = 0
        if disc_val > 0:
            if disc_type == "PERCENTAGE":
                # Percentage of selling price
                unit_disc = round(unit_price * (min(disc_val, 100.0) / 100.0))
                line_discount_paise = unit_disc * qty
            else:
                # Flat Rupee amount to paise
                flat_paise = round(disc_val * 100)
                if disc_calc == "per_line":
                    line_discount_paise = min(flat_paise, line_total)
                else:
                    unit_disc = min(flat_paise, unit_price)
                    line_discount_paise = unit_disc * qty

        # Financial safety: discount cannot make line negative
        line_discount_paise = max(0, min(line_discount_paise, line_total))

        # Referrer Commission Calculation
        raw_comm_type = (rule.get("commission_type") or rule.get("reward_type") or "PERCENTAGE").upper()
        comm_type = "PERCENTAGE" if "PERCENT" in raw_comm_type else "FLAT"
        comm_val = float(rule.get("commission_value") or rule.get("value", 0.0))
        comm_calc = rule.get("commission_calc_type") or settings.get("flat_quantity_semantics", "per_unit")
        comm_basis_mode = rule.get("commission_basis") or settings.get("commission_price_basis", "selling_price")

        # Commission basis in paise
        if comm_basis_mode == "net_price":
            comm_basis_paise = max(0, line_total - line_discount_paise)
        else:
            comm_basis_paise = line_total

        line_commission_paise = 0
        if comm_val > 0:
            if comm_type == "PERCENTAGE":
                line_commission_paise = round(comm_basis_paise * (min(comm_val, 100.0) / 100.0))
            else:
                flat_comm_paise = round(comm_val * 100)
                if comm_calc == "per_line":
                    line_commission_paise = flat_comm_paise
                else:
                    line_commission_paise = flat_comm_paise * qty

        line_meta = {
            "variant_id": variant_id,
            "product_id": product_id,
            "product_name": product_name,
            "referral_eligible": True,
            "referral_rule_id": rule.get("id"),
            "referral_rule_name": rule.get("rule_name") or rule.get("name") or "Product Referral Rule",
            "customer_discount_type": disc_type,
            "customer_discount_value": disc_val,
            "customer_discount_amount": line_discount_paise,
            "referral_discount": line_discount_paise,
            "commission_type": comm_type,
            "commission_value": comm_val,
            "commission_basis": comm_basis_paise,
            "commission_amount": line_commission_paise,
            "qty": qty,
            "unit_price": unit_price,
            "line_total": line_total,
        }

        lines_meta[item_key] = line_meta
        if line_discount_paise > 0 or line_commission_paise > 0:
            breakdown.append(line_meta)

        total_discount_paise += line_discount_paise

    out["lines_meta"] = lines_meta
    out["breakdown"] = breakdown
    out["referral_discount"] = total_discount_paise
    out["referral_status"] = "valid"

    if total_discount_paise > 0:
        out["referral_note"] = f"Referral code {clean_code} applied. Product-specific discounts activated."
    else:
        out["referral_note"] = f"Referral code {clean_code} applied. No referral discount on current items."

    return out


async def record_order_commissions(order: dict) -> List[dict]:
    """Idempotently create line-level commission records in db.referral_rewards upon verified order payment."""
    referral_code = order.get("referral_code")
    referrer_id = order.get("referred_by_user_id")
    order_id = order.get("id")

    if not referral_code or not referrer_id or not order_id:
        return []

    # Idempotency guard: check if commission was already created for this order
    existing_commissions = await db.referral_rewards.find({"order_id": order_id}).to_list(100)
    if existing_commissions:
        logger.info("Order %s already has %d commission record(s); skipping duplicate", order_id, len(existing_commissions))
        return existing_commissions

    created_records = []
    order_number = order.get("order_number", "")
    order_date = order.get("created_at") or now_utc()

    for idx, item in enumerate(order.get("items", [])):
        if not item.get("referral_eligible"):
            continue

        comm_amt = item.get("commission_amount", 0)
        if comm_amt <= 0:
            continue

        reward_id = f"rew_{uuid.uuid4().hex[:12]}"
        reward_doc = {
            "id": reward_id,
            "order_id": order_id,
            "order_number": order_number,
            "order_date": order_date,
            "user_id": referrer_id,
            "code": referral_code,
            "line_index": idx,
            "product_id": item.get("product_id"),
            "product_name": item.get("product_name"),
            "product_slug": item.get("product_slug"),
            "sku": item.get("sku"),
            "quantity": item.get("qty", 1),
            "sale_value": item.get("line_total", 0),  # paise
            "eligible_sale_value": item.get("commission_basis", item.get("line_total", 0)),  # paise
            "rule_id": item.get("referral_rule_id"),
            "rule_name": item.get("referral_rule_name"),
            "commission_type": item.get("commission_type"),
            "commission_value": item.get("commission_value"),
            "commission_amount": comm_amt,  # paise
            # Convert paise to Rupees for wallet calculations and legacy reward ledgers
            "amount": round(comm_amt / 100.0, 2),
            "customer_discount_amount": item.get("customer_discount_amount", 0),  # paise
            "status": "pending",  # pending -> approved -> paid (or reversed on return)
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }

        await db.referral_rewards.insert_one(reward_doc)
        created_records.append(reward_doc)
        logger.info(
            "Created referral commission reward %s: Rs %s for referrer %s on product %s (order %s)",
            reward_id, reward_doc["amount"], referrer_id, item.get("product_name"), order_number
        )

    # Update or insert attribution conversion
    try:
        await db.referral_attributions.update_one(
            {"code": referral_code, "order_number": None},
            {"$set": {"converted": True, "order_number": order_number, "order_id": order_id, "sale_value": round(order.get("amounts", {}).get("total", 0) / 100.0, 2)}},
        )
    except Exception as exc:
        logger.warning("Could not update referral attribution: %s", exc)

    return created_records


async def reverse_order_commissions(order_id: str, reason: str = "Order cancelled / refunded") -> int:
    """Safely reverse pending/approved commissions on returns or cancellations without deleting history."""
    res = await db.referral_rewards.update_many(
        {"order_id": order_id, "status": {"$in": ["pending", "approved"]}},
        {"$set": {"status": "reversed", "reversal_reason": reason, "reversed_at": now_utc()}},
    )
    logger.info("Reversed %d referral rewards for order %s: %s", res.modified_count, order_id, reason)
    return res.modified_count
