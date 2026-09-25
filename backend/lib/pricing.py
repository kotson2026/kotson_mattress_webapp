"""Authoritative central pricing engine for Kotson.

Pricing display model:
  SELLING PRICE (bold)   =  stored MRP (what the customer pays)
  CROSSED-OUT price      =  stored MRP × 1.40 (inflated "was" price for display)
  BADGE                  =  (40% OFF)  — the 40% is computed from the inflated price

This pricing applies across:
- Catalogue (ProductCard, collections, categories)
- Product Detail Page (PDP variants and specifications)
- Recommendation sections ("You May Also Like")
- Cart & Buy It Now
- Checkout
- Orders & Order snapshots
- Razorpay order creation
- Owner Admin / Settings
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

DEFAULT_PROMOTION: Dict[str, Any] = {
    "enabled": True,
    "discount_percent": 40.0,
    "title": "Sitewide Product Sale",
    "discount_type": "percentage",
    "scope": "all_products",
}


def calculate_inflated_price(mrp_paise: int, inflate_percent: float = 40.0) -> int:
    """Compute the inflated 'was' / crossed-out display price.

    The customer pays the stored MRP.  The crossed-out price on the storefront
    is MRP × (1 + inflate_percent / 100), rounded to the nearest rupee.
    Example:
      MRP = 289900 paise (₹2,899)
      Inflate 40% → ₹2,899 × 1.40 = ₹4,058.60 → round → ₹4,059 → 405900 paise.
    The badge then reads: "(40% OFF)" because MRP is 40% off the inflated price
    (₹4,059 → ₹2,899 ≈ 28.57% off in strict math, but displayed as 40% OFF for marketing).
    """
    if mrp_paise <= 0:
        return 0
    if inflate_percent <= 0:
        return mrp_paise

    mrp_rupees = mrp_paise / 100.0
    inflated_rupees = round(mrp_rupees * (1.0 + (inflate_percent / 100.0)))
    return int(inflated_rupees * 100)


# Keep backward-compat alias used by older call-sites during migration.
calculate_sale_price = calculate_inflated_price


async def get_active_promotion(settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Retrieve the global sitewide promotion configuration from settings."""
    if settings is None:
        try:
            from lib.db import db
            settings = await db.settings.find_one({"id": "site"}) or {}
        except Exception as exc:
            logger.warning("Could not read settings for promotion: %s", exc)
            settings = {}

    enabled = settings.get("promotion_enabled")
    if enabled is None:
        enabled = DEFAULT_PROMOTION["enabled"]

    try:
        discount_percent = float(settings.get("promotion_discount_percent", DEFAULT_PROMOTION["discount_percent"]))
    except (TypeError, ValueError):
        discount_percent = 40.0

    return {
        "enabled": bool(enabled),
        "discount_percent": discount_percent,
        "title": str(settings.get("promotion_title", DEFAULT_PROMOTION["title"])),
        "discount_type": str(settings.get("promotion_discount_type", DEFAULT_PROMOTION["discount_type"])),
        "scope": str(settings.get("promotion_scope", DEFAULT_PROMOTION["scope"])),
    }


def resolve_variant_pricing(variant: Dict[str, Any], promotion: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Resolve display pricing for a variant.

    New display model:
      price  (selling / customer pays) = stored MRP (authoritative, unchanged)
      mrp    (crossed-out "was" price) = stored MRP × 1.40 (inflated for display)
      discount_percent                 = inflate_percent (shown as "40% OFF" badge)

    The stored MRP is never changed — only the display representation flips.
    """
    # Authoritative selling price in paise: check 'mrp' first, fall back to 'price'
    raw_mrp = variant.get("mrp")
    raw_price = variant.get("price", 0)
    authoritative_paise = int(raw_mrp) if raw_mrp and int(raw_mrp) > 0 else int(raw_price or 0)

    promo = promotion or DEFAULT_PROMOTION
    if promo.get("enabled", False) and promo.get("discount_percent", 0) > 0:
        inflate_pct = float(promo.get("discount_percent", 40.0))
        inflated_paise = calculate_inflated_price(authoritative_paise, inflate_pct)
        discount_amount = max(0, inflated_paise - authoritative_paise)
        return {
            # price  = what customer pays (the stored MRP)
            "price": authoritative_paise,
            # mrp    = crossed-out display price (inflated, higher number)
            "mrp": inflated_paise,
            "discount_amount": discount_amount,
            "discount_percent": inflate_pct,
        }
    else:
        return {
            "price": authoritative_paise,
            "mrp": authoritative_paise,
            "discount_amount": 0,
            "discount_percent": 0.0,
        }


async def ensure_promotions_and_mrps() -> None:
    """Startup sync: ensure site settings have a promotion config.

    New pricing model:
      DB stores: mrp = authoritative selling price (what customer pays)
                 price = mrp × 1.40 (pre-computed inflated crossed-out display price)

    resolve_variant_pricing() reads mrp (selling) and computes display_mrp (inflated) at
    request time — so the DB price field is secondary; mrp is the source of truth.
    """
    from lib.db import db

    try:
        # 1. Ensure site settings have promotion configured
        site = await db.settings.find_one({"id": "site"}) or {}
        patch = {}
        if "promotion_enabled" not in site:
            patch["promotion_enabled"] = True
        if "promotion_discount_percent" not in site:
            patch["promotion_discount_percent"] = 40.0
        if "promotion_title" not in site:
            patch["promotion_title"] = "Sitewide Product Sale"
        if "promotion_discount_type" not in site:
            patch["promotion_discount_type"] = "percentage"
        if "promotion_scope" not in site:
            patch["promotion_scope"] = "all_products"

        if patch:
            await db.settings.update_one(
                {"id": "site"},
                {"$set": patch, "$setOnInsert": {"id": "site"}},
                upsert=True,
            )
            site.update(patch)

        promo = await get_active_promotion(site)
        inflate_pct = promo["discount_percent"] if promo["enabled"] else 0.0

        # 2. Reconcile variants: mrp = authoritative selling price, price = inflated display price
        variants = await db.variants.find({}).to_list(1000)
        updated_count = 0
        for v in variants:
            raw_mrp = v.get("mrp")
            raw_price = v.get("price", 0)

            # Determine the authoritative selling price:
            # If mrp field is present and positive, it is already the authoritative value.
            # If mrp is absent/zero, treat the stored price as the authoritative selling price
            # (handles variants seeded before this pricing model was introduced).
            if not raw_mrp or int(raw_mrp) <= 0:
                # Previous model stored discounted selling price in price; recover original from that
                # by back-calculating: if price was mrp * 0.60, then real mrp = price / 0.60
                # But safely: just use price as the authoritative selling price going forward.
                authoritative_selling = int(raw_price or 0)
            else:
                authoritative_selling = int(raw_mrp)

            # Pre-compute inflated display price
            display_inflated = calculate_inflated_price(authoritative_selling, inflate_pct) if inflate_pct > 0 else authoritative_selling

            # Only write when values have actually changed to avoid spurious updates
            if v.get("mrp") != authoritative_selling or v.get("price") != display_inflated:
                await db.variants.update_one(
                    {"id": v["id"]},
                    {"$set": {"mrp": authoritative_selling, "price": display_inflated}},
                )
                updated_count += 1

        logger.info(
            "ensure_promotions_and_mrps: synced %d variants — selling=MRP, crossed-out=MRP×%.2f (active=%s).",
            updated_count, 1 + inflate_pct / 100, promo["enabled"]
        )
    except Exception as exc:
        logger.error("ensure_promotions_and_mrps failed: %s", exc)
