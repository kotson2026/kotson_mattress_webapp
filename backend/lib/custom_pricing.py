"""Authoritative Custom Pricing Service & Validation for Kotson Customizable Products.

Enforces server-side authority for custom dimensions, option selection, manufacturing limits,
and pricing calculation according to Kotson business rules.
"""

import math
from typing import Any, Dict, List, Optional, Tuple
from lib.pricing import get_active_promotion, resolve_variant_pricing


class CustomPricingService:
    """Authoritative singleton/static service for custom product calculations."""

    @staticmethod
    def validate_dimensions(product: Dict[str, Any], dimensions: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate customer-supplied dimensions against product manufacturing rules."""
        custom_cfg = product.get("customization") or {}
        if not custom_cfg.get("enabled", False):
            return False, f"Product '{product.get('name', 'Product')}' is not currently available for custom ordering."

        dim_rules = custom_cfg.get("dimensions") or {}
        if not dim_rules:
            # Fallback to standard mattress boundary defaults if not configured
            dim_rules = {
                "length": {"min": 60.0, "max": 84.0, "step": 1.0},
                "breadth": {"min": 30.0, "max": 78.0, "step": 1.0},
                "thickness": {"min": 4.0, "max": 12.0, "step": 1.0, "allowed_values": [4, 5, 6, 8, 10, 12]},
            }

        for dim_name, rule in dim_rules.items():
            if dim_name not in dimensions:
                return False, f"Missing required dimension: {dim_name.capitalize()}"

            val_raw = dimensions.get(dim_name)
            try:
                val = float(val_raw)
            except (TypeError, ValueError):
                return False, f"Invalid value for {dim_name}: must be a valid number."

            if math.isnan(val) or math.isinf(val) or val <= 0:
                return False, f"{dim_name.capitalize()} must be a positive number greater than 0."

            min_val = float(rule.get("min", 0))
            max_val = float(rule.get("max", 9999))
            if val < min_val:
                return False, f"{dim_name.capitalize()} cannot be less than {min_val} in."
            if val > max_val:
                return False, f"{dim_name.capitalize()} cannot exceed manufacturing limit of {max_val} in."

            allowed = rule.get("allowed_values")
            if allowed and isinstance(allowed, list) and len(allowed) > 0:
                allowed_floats = [float(x) for x in allowed]
                if not any(math.isclose(val, x, abs_tol=0.01) for x in allowed_floats):
                    allowed_str = ", ".join(str(int(x) if x.is_integer() else x) for x in allowed_floats)
                    return False, f"{dim_name.capitalize()} must be one of allowed options: {allowed_str} in."

            step = float(rule.get("step", 1.0))
            if step > 0:
                # check step from min
                remainder = (val - min_val) % step
                if not (math.isclose(remainder, 0.0, abs_tol=0.01) or math.isclose(remainder, step, abs_tol=0.01)):
                    return False, f"{dim_name.capitalize()} must be in increments of {step} in."

        return True, ""

    @staticmethod
    def validate_and_resolve_options(
        product: Dict[str, Any], raw_selected_options: List[Dict[str, Any]]
    ) -> Tuple[bool, str, List[Dict[str, Any]]]:
        """Validate selected options against product configuration and return authoritative snapshots."""
        custom_cfg = product.get("customization") or {}
        configured_options = custom_cfg.get("options") or []
        
        # Build lookup maps for configured options
        opt_map = {opt.get("id"): opt for opt in configured_options if opt.get("enabled", True)}
        # Also map by name lowercase for resilience
        opt_name_map = {opt.get("name", "").strip().lower(): opt for opt in configured_options if opt.get("enabled", True)}

        selected_map = {}
        for sel in raw_selected_options:
            oid = sel.get("option_id") or sel.get("id")
            oname = (sel.get("option_name") or sel.get("name") or "").strip().lower()
            target_opt = opt_map.get(oid) or opt_name_map.get(oname)
            if target_opt:
                selected_map[target_opt.get("id")] = (target_opt, sel)

        # Check required options
        for opt in configured_options:
            if opt.get("enabled", True) and opt.get("required", False):
                if opt.get("id") not in selected_map:
                    return False, f"Required option '{opt.get('display_label') or opt.get('name')}' must be selected.", []

        resolved_options: List[Dict[str, Any]] = []
        for opt_id, (opt_def, sel_input) in selected_map.items():
            val_id = sel_input.get("value_id")
            val_name = (sel_input.get("value_name") or sel_input.get("value_label") or "").strip().lower()

            matching_val = None
            for v in opt_def.get("values", []):
                if not v.get("enabled", True):
                    continue
                if val_id and v.get("id") == val_id:
                    matching_val = v
                    break
                if val_name and (v.get("name", "").strip().lower() == val_name or v.get("display_label", "").strip().lower() == val_name):
                    matching_val = v
                    break

            if not matching_val:
                return False, f"Invalid choice for option '{opt_def.get('name')}'.", []

            resolved_options.append({
                "option_id": opt_def.get("id"),
                "option_name": opt_def.get("name"),
                "option_label": opt_def.get("display_label") or opt_def.get("name"),
                "value_id": matching_val.get("id"),
                "value_name": matching_val.get("name"),
                "value_label": matching_val.get("display_label") or matching_val.get("name"),
                "description": matching_val.get("description", ""),
                "image": matching_val.get("image", ""),
                "additional_price": int(matching_val.get("additional_price", 0)),
            })

        return True, "", resolved_options

    @staticmethod
    async def calculate_custom_price(
        product: Dict[str, Any],
        dimensions: Dict[str, Any],
        resolved_options: List[Dict[str, Any]],
        is_standard: bool = False,
        standard_variant: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Authoritative pricing calculation.

        BASE PRODUCT + DIMENSION-BASED PRICE + OPTION MODIFIERS - ACTIVE DISCOUNT IF ELIGIBLE = FINAL PRICE.
        If pricing formula is not explicitly configured or approved by business, returns PRICE ON REQUEST / QUOTE STATE.
        """
        # Sum of option price modifiers
        options_additional_paise = sum(int(opt.get("additional_price", 0)) for opt in resolved_options)

        # 1. Standard variant path (existing authoritative variants)
        if is_standard and standard_variant:
            promo = await get_active_promotion()
            vp = resolve_variant_pricing(standard_variant, promo)
            base_price = vp["price"]
            mrp = vp["mrp"]
            discount_amount = vp.get("discount_amount", 0)
            final_price = base_price + options_additional_paise
            final_mrp = (mrp + options_additional_paise) if mrp else None

            return {
                "pricing_status": "confirmed",
                "is_custom": False,
                "quote_label": None,
                "unit_price": final_price,
                "mrp": final_mrp,
                "base_price": base_price,
                "option_modifiers_total": options_additional_paise,
                "discount_amount": discount_amount,
                "discount_percent": vp.get("discount_percent", 0.0),
                "promotion_eligible": True,
                "currency": "INR",
            }

        # 2. Custom dimensions path
        custom_cfg = product.get("customization") or {}
        pricing_cfg = custom_cfg.get("pricing") or {}
        pricing_mode = pricing_cfg.get("pricing_mode", "quote_pending")
        promotion_eligible = bool(pricing_cfg.get("promotion_eligible", False))

        # Check if pricing formula is enabled
        if pricing_mode == "formula" or pricing_mode == "base_variant_ratio":
            # Approved calculation based on mattress surface area and thickness ratio
            # Standard reference: Queen 78 in x 60 in x 6 in = 28,080 cu in / 4680 sq in
            length = float(dimensions.get("length", 78))
            breadth = float(dimensions.get("breadth", 60))
            thickness = float(dimensions.get("thickness", 6))

            # Retrieve base product reference price
            price_from = product.get("price_from")
            if not price_from and product.get("variants"):
                price_from = min(v.get("price", 0) for v in product["variants"] if v.get("price"))
            base_ref = int(price_from or 5000000)  # paise default

            ref_sq_in = 78.0 * 60.0
            ref_thickness = 6.0

            area_ratio = (length * breadth) / ref_sq_in
            thickness_ratio = thickness / ref_thickness

            # Dimension-based base price
            computed_base_paise = int(base_ref * area_ratio * (0.7 + 0.3 * thickness_ratio))
            
            # Enforce minimum threshold if configured
            min_price = pricing_cfg.get("min_price_paise")
            if min_price and computed_base_paise < int(min_price):
                computed_base_paise = int(min_price)

            subtotal_paise = computed_base_paise + options_additional_paise

            # Discount handling: Only apply global promotion if explicitly marked promotion_eligible
            discount_amount = 0
            discount_percent = 0.0
            if promotion_eligible:
                promo = await get_active_promotion()
                if promo.get("enabled"):
                    discount_percent = promo.get("discount_percent", 40.0)
                    # Use existing Kotson pricing rule: subtotal is selling price, MRP is inflated
            
            # Formatted MRP and Selling Price
            final_selling_price = subtotal_paise
            final_mrp = int(round(final_selling_price * 1.40)) if promotion_eligible else final_selling_price

            return {
                "pricing_status": "confirmed",
                "is_custom": True,
                "quote_label": None,
                "unit_price": final_selling_price,
                "mrp": final_mrp,
                "base_price": computed_base_paise,
                "option_modifiers_total": options_additional_paise,
                "discount_amount": max(0, final_mrp - final_selling_price) if promotion_eligible else 0,
                "discount_percent": discount_percent if promotion_eligible else 0.0,
                "promotion_eligible": promotion_eligible,
                "currency": "INR",
            }

        # 3. Default safe state: PRICE ON REQUEST / PRICE WILL BE CONFIRMED
        return {
            "pricing_status": "price_on_request",
            "is_custom": True,
            "quote_label": "PRICE WILL BE CONFIRMED",
            "unit_price": 0,
            "mrp": None,
            "base_price": 0,
            "option_modifiers_total": options_additional_paise,
            "discount_amount": 0,
            "discount_percent": 0.0,
            "promotion_eligible": False,
            "currency": "INR",
        }
