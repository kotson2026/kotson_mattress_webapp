"""Cart: guest-session or authenticated cart; every read reprices server-side from active variants."""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.crm_intake import capture_cart_intent
from lib.db import db
from lib.security import CART_COOKIE, optional_user
from lib.services import clean_doc
from models.orders import CartItemIn, CartItemPatch, CartLine, CartView, ReferralApplyIn

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_or_create_cart(request: Request, response: Response, user):
    token = request.cookies.get(CART_COOKIE)
    if user:
        cart = await db.carts.find_one({"user_id": user["id"]})
        if not cart:
            # Check if guest cart exists with this token to claim it
            if token:
                guest_cart = await db.carts.find_one({"token": token})
                if guest_cart and not guest_cart.get("user_id"):
                    await db.carts.update_one({"_id": guest_cart["_id"]}, {"$set": {"user_id": user["id"]}})
                    guest_cart["user_id"] = user["id"]
                    cart = guest_cart
            if not cart:
                new_token = str(uuid.uuid4())
                doc = {
                    "id": str(uuid.uuid4()),
                    "token": new_token,
                    "user_id": user["id"],
                    "items": [],
                    "referred_code": user.get("referred_by") or None,
                }
                await db.carts.insert_one(doc)
                cart = doc
                response.set_cookie(CART_COOKIE, cart["token"], max_age=90 * 24 * 3600,
                                    httponly=True, samesite="lax", path="/")
        if user.get("referred_by") and not cart.get("referred_code"):
            await db.carts.update_one({"id": cart["id"]}, {"$set": {"referred_code": user["referred_by"]}})
            cart["referred_code"] = user["referred_by"]
        return cart

    if token:
        cart = await db.carts.find_one({"token": token, "user_id": None})
        if cart:
            if not cart.get("referred_code"):
                # Check if click session had a referral code
                click = await db.referral_clicks.find_one({"session_id": token}, sort=[("timestamp", -1)])
                if click and click.get("referral_code"):
                    await db.carts.update_one({"id": cart["id"]}, {"$set": {"referred_code": click["referral_code"]}})
                    cart["referred_code"] = click["referral_code"]
            return cart

    new_token = str(uuid.uuid4())
    doc = {
        "id": str(uuid.uuid4()),
        "token": new_token,
        "user_id": None,
        "items": [],
        "referred_code": None,
    }
    await db.carts.insert_one(doc)
    response.set_cookie(CART_COOKIE, doc["token"], max_age=90 * 24 * 3600,
                        httponly=True, samesite="lax", path="/")
    return doc



from lib.referral_pricing import evaluate_product_referrals


async def evaluate_referral(code: Optional[str], user, subtotal: int) -> dict:
    """Safe fallback delegating to authoritative product referral engine."""
    return await evaluate_product_referrals([], code, user)



from lib.custom_pricing import CustomPricingService
from lib.pricing import get_active_promotion, resolve_variant_pricing


async def cart_view(cart: dict, user) -> CartView:
    promo = await get_active_promotion()
    lines: list[CartLine] = []
    subtotal = 0
    total_mrp = 0
    for item in cart.get("items", []):
        config_id = item.get("custom_configuration_id")
        custom_cfg = None
        if config_id:
            custom_cfg = await db.custom_configurations.find_one({"id": config_id})

        v = await db.variants.find_one({"id": item["variant_id"]})
        if not v and custom_cfg and custom_cfg.get("product_id"):
            v = await db.variants.find_one({"product_id": custom_cfg["product_id"]})
        if not v:
            continue
        p = await db.products.find_one({"id": v["product_id"]})
        if not p:
            continue

        img = None
        if p.get("images") and len(p["images"]) > 0:
            img = p["images"][0]
        elif p.get("primary_image"):
            img = p["primary_image"]

        qty = int(item["qty"])

        if custom_cfg:
            dims = custom_cfg.get("dimensions") or {}
            is_std = custom_cfg.get("is_standard", False)
            pricing = await CustomPricingService.calculate_custom_price(
                product=p,
                dimensions=dims,
                resolved_options=custom_cfg.get("options") or [],
                is_standard=is_std,
                standard_variant=v if is_std else None,
            )
            unit_price = pricing["unit_price"]
            mrp = pricing.get("mrp")
            line_total = unit_price * qty
            dim_desc = f"{dims.get('length', '')} × {dims.get('breadth', '')} in" if not is_std else v["size"]

            line = CartLine(
                variant_id=v["id"],
                product_id=p["id"],
                product_slug=p["slug"],
                product_name=p["name"],
                sku=v["sku"],
                size=dim_desc,
                length=str(dims.get("length")) if dims.get("length") else v.get("length"),
                width=str(dims.get("breadth")) if dims.get("breadth") else v.get("width"),
                thickness=str(dims.get("thickness")) if dims.get("thickness") else v.get("thickness"),
                firmness=v.get("firmness"),
                qty=qty,
                unit_price=unit_price,
                line_total=line_total,
                mrp=mrp,
                discount_amount=pricing.get("discount_amount", 0),
                discount_percent=pricing.get("discount_percent", 0.0),
                stock=int(v.get("stock", 99)),
                free_stock=99 if not is_std else max(0, int(v["stock"]) - int(v.get("reserved", 0))),
                is_active=bool(p.get("is_active")),
                image=img,
                is_custom=not is_std,
                custom_configuration_id=config_id,
                custom_dimensions=dims,
                custom_options=custom_cfg.get("options") or [],
                custom_pricing_status=pricing.get("pricing_status"),
                custom_quote_label=pricing.get("quote_label"),
            )
        else:
            pricing = resolve_variant_pricing(v, promo)
            unit_price = pricing["price"]
            mrp = pricing["mrp"]
            free_stock = max(0, int(v["stock"]) - int(v.get("reserved", 0)))
            line_total = unit_price * qty
            line = CartLine(
                variant_id=v["id"],
                product_id=p["id"],
                product_slug=p["slug"],
                product_name=p["name"],
                sku=v["sku"],
                size=v["size"],
                length=v.get("length"),
                width=v.get("width"),
                thickness=v.get("thickness"),
                firmness=v.get("firmness"),
                qty=qty,
                unit_price=unit_price,
                line_total=line_total,
                mrp=mrp,
                discount_amount=pricing["discount_amount"],
                discount_percent=pricing["discount_percent"],
                stock=int(v["stock"]),
                free_stock=free_stock,
                is_active=bool(v.get("is_active")) and bool(p.get("is_active")),
                image=img,
                is_custom=False,
            )

        lines.append(line)
        if line.is_active:
            subtotal += line.line_total
            total_mrp += (mrp or unit_price) * qty
    ref = await evaluate_product_referrals(lines, cart.get("referred_code"), user)
    for line in lines:
        item_key = line.variant_id or line.product_id
        if item_key in ref.get("lines_meta", {}):
            meta = ref["lines_meta"][item_key]
            line.referral_eligible = meta.get("referral_eligible", False)
            line.referral_discount = meta.get("referral_discount", 0)
            line.referral_rule_id = meta.get("referral_rule_id")
            line.referral_rule_name = meta.get("referral_rule_name")

    return CartView(
        items=lines, item_count=sum(l.qty for l in lines if l.is_active), subtotal=subtotal,
        total_mrp=total_mrp, total_discount=max(0, total_mrp - subtotal),
        referred_code=ref["referred_code"], referral_status=ref["referral_status"],
        referral_discount=ref["referral_discount"], referral_note=ref["referral_note"],
        referral_breakdown=ref.get("breakdown", []),
    )


@router.get("/cart", response_model=CartView)
async def get_cart(request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    return await cart_view(cart, user)


@router.post("/cart/items", response_model=CartView)
async def add_item(input: CartItemIn, request: Request, response: Response, user=Depends(optional_user)):
    custom_cfg = None
    if input.custom_configuration_id:
        custom_cfg = await db.custom_configurations.find_one({"id": input.custom_configuration_id})
        if not custom_cfg:
            raise HTTPException(status_code=404, detail="Custom configuration not found or expired")
        p = await db.products.find_one({"id": custom_cfg["product_id"], "is_active": True})
        if not p:
            raise HTTPException(status_code=404, detail="Product is unavailable")
        v = None
        if custom_cfg.get("standard_variant_id"):
            v = await db.variants.find_one({"id": custom_cfg["standard_variant_id"], "is_active": True})
        if not v:
            v = await db.variants.find_one({"product_id": p["id"], "is_active": True})
        if not v:
            raise HTTPException(status_code=404, detail="No active variant found for product")
    else:
        v = await db.variants.find_one({"id": input.variant_id, "is_active": True})
        if not v:
            raise HTTPException(status_code=404, detail="This variant is unavailable")
        p = await db.products.find_one({"id": v["product_id"], "is_active": True})
        if not p:
            raise HTTPException(status_code=404, detail="This product is unavailable")

    free_stock = max(0, int(v["stock"]) - int(v.get("reserved", 0)))
    if not input.custom_configuration_id and free_stock < input.qty:
        raise HTTPException(status_code=409, detail=f"Only {free_stock} unit(s) available right now")

    cart = await get_or_create_cart(request, response, user)
    existing_items = cart.get("items", [])
    
    updated = False
    new_items = []
    for it in existing_items:
        if it.get("variant_id") == v["id"] and it.get("custom_configuration_id") == input.custom_configuration_id:
            new_qty = min(it.get("qty", 0) + input.qty, 10 if input.custom_configuration_id else free_stock)
            new_items.append({
                "variant_id": v["id"],
                "qty": new_qty,
                "custom_configuration_id": input.custom_configuration_id,
            })
            updated = True
        else:
            new_items.append(it)

    if not updated:
        new_items.append({
            "variant_id": v["id"],
            "qty": input.qty,
            "custom_configuration_id": input.custom_configuration_id,
        })

    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": new_items}})
    cart = await db.carts.find_one({"id": cart["id"]})

    # CRM intake: one open cart opportunity per identified customer; guests recorded, never called.
    try:
        await capture_cart_intent(user, cart, v, p)
    except Exception:
        logger.exception("CRM cart intake failed for cart %s", cart["id"])

    # Referral Lead Attribution: qualify as CART_ACTIVE when product added to cart
    if cart.get("referred_code"):
        try:
            from lib.referral_lead_service import qualify_or_update_lead
            await qualify_or_update_lead(
                code=cart["referred_code"],
                event_type="CART_ACTIVE",
                cart_token=cart.get("token"),
                user_id=user["id"] if user else None,
                user=user,
                metadata={"product_id": p.get("id"), "variant_id": v.get("id"), "qty": input.qty},
            )
        except Exception:
            logger.exception("Referral lead qualification failed on cart item add")

    return await cart_view(cart, user)


@router.patch("/cart/items", response_model=CartView)
async def patch_item(input: CartItemPatch, request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    new_items = []
    for it in cart.get("items", []):
        matches = (it.get("variant_id") == input.variant_id and it.get("custom_configuration_id") == input.custom_configuration_id)
        if matches:
            if input.qty > 0:
                new_items.append({
                    "variant_id": input.variant_id,
                    "qty": input.qty,
                    "custom_configuration_id": input.custom_configuration_id,
                })
        else:
            new_items.append(it)
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": new_items}})
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)


@router.delete("/cart/items/{variant_id}", response_model=CartView)
async def remove_item(
    variant_id: str,
    request: Request,
    response: Response,
    config_id: Optional[str] = None,
    user=Depends(optional_user),
):
    cart = await get_or_create_cart(request, response, user)
    new_items = []
    for it in cart.get("items", []):
        if config_id and it.get("variant_id") == variant_id and it.get("custom_configuration_id") == config_id:
            continue
        elif it.get("custom_configuration_id") == variant_id:
            continue
        elif it.get("variant_id") == variant_id and not config_id and not it.get("custom_configuration_id"):
            continue
        new_items.append(it)
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": new_items}})
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)


@router.post("/cart/referral", response_model=CartView)
async def apply_referral(input: ReferralApplyIn, request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    code = (input.code or "").strip().upper() or None
    if code:
        referrer = await db.users.find_one({"referral_code": code, "is_active": True})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid or inactive referral code")
        if user and user.get("id") == referrer["id"]:
            raise HTTPException(status_code=400, detail="Self-referral is not permitted")


    await db.carts.update_one({"id": cart["id"]}, {"$set": {"referred_code": code}})
    cart = await db.carts.find_one({"id": cart["id"]})

    if code and cart.get("items"):
        try:
            from lib.referral_lead_service import qualify_or_update_lead
            await qualify_or_update_lead(
                code=code,
                event_type="CART_ACTIVE",
                cart_token=cart.get("token"),
                user_id=user["id"] if user else None,
                user=user,
                metadata={"action": "referral_applied_to_cart"},
            )
        except Exception:
            logger.exception("Referral lead qualification failed on apply_referral")

    return await cart_view(cart, user)

