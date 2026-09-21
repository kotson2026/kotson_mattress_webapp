"""Cart: guest-session or authenticated cart; every read reprices server-side from active variants."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.db import db
from lib.security import CART_COOKIE, optional_user
from lib.services import clean_doc
from models.orders import CartItemIn, CartItemPatch, CartLine, CartView, ReferralApplyIn

router = APIRouter()


async def get_or_create_cart(request: Request, response: Response, user):
    token = request.cookies.get(CART_COOKIE)
    if user:
        cart = await db.carts.find_one({"user_id": user["id"]})
        if not cart:
            doc = {"id": str(uuid.uuid4()), "token": token or str(uuid.uuid4()),
                   "user_id": user["id"], "items": [], "referred_code": None}
            await db.carts.insert_one(doc)
            cart = doc
            if not token:
                response.set_cookie(CART_COOKIE, cart["token"], max_age=90 * 24 * 3600,
                                    httponly=True, samesite="lax", path="/")
        return cart
    if token:
        cart = await db.carts.find_one({"token": token, "user_id": None})
        if cart:
            return cart
    doc = {"id": str(uuid.uuid4()), "token": token or str(uuid.uuid4()),
           "user_id": None, "items": [], "referred_code": None}
    await db.carts.insert_one(doc)
    response.set_cookie(CART_COOKIE, doc["token"], max_age=90 * 24 * 3600,
                        httponly=True, samesite="lax", path="/")
    return doc


async def evaluate_referral(code: Optional[str], user, subtotal: int) -> dict:
    """Safe default: 0 discount until the owner publishes a rule. Never promise economics."""
    out = {"referred_code": code, "referral_status": "none", "referral_discount": 0, "referral_note": ""}
    if not code:
        return out
    code = code.strip().upper()
    owner = await db.users.find_one({"referral_code": code, "is_active": True})
    if not owner:
        out["referral_status"] = "invalid"
        out["referral_note"] = "This referral code was not found."
        return out
    if user and owner["id"] == user["id"]:
        out["referral_status"] = "self"
        out["referral_note"] = "You cannot use your own referral code."
        return out
    rule = await db.referral_rules.find_one(
        {"reward_type": "referee_discount", "status": "published"}, sort=[("created_at", -1)]
    )
    if not rule:
        out["referral_status"] = "no_published_rule"
        out["referral_note"] = (
            "Code recorded as attribution. No published referral benefit is configured yet, "
            "so no discount applies."
        )
        return out
    if subtotal < rule.get("min_spend_paise", 0):
        out["referral_status"] = "no_published_rule"
        out["referral_note"] = "Order is below the minimum spend for this referral benefit."
        return out
    discount = 0
    if rule["value_type"] == "percent":
        discount = subtotal * min(rule["value"], 100) // 100
    else:
        discount = min(rule["value"], subtotal)
    out["referral_status"] = "valid"
    out["referral_discount"] = discount
    out["referral_note"] = f"Published rule \"{rule['name']}\" applies."
    return out


async def cart_view(cart: dict, user) -> CartView:
    lines: list[CartLine] = []
    subtotal = 0
    for item in cart.get("items", []):
        v = await db.variants.find_one({"id": item["variant_id"]})
        if not v:
            continue
        p = await db.products.find_one({"id": v["product_id"]})
        if not p:
            continue
        free_stock = max(0, int(v["stock"]) - int(v.get("reserved", 0)))
        qty = int(item["qty"])
        line = CartLine(
            variant_id=v["id"], product_id=p["id"], product_slug=p["slug"], product_name=p["name"],
            sku=v["sku"], size=v["size"], thickness=v.get("thickness"), firmness=v.get("firmness"),
            qty=qty, unit_price=int(v["price"]), line_total=int(v["price"]) * qty,
            stock=int(v["stock"]), free_stock=free_stock, is_active=bool(v.get("is_active")) and bool(p.get("is_active")),
        )
        lines.append(line)
        if line.is_active:
            subtotal += line.line_total
    ref = await evaluate_referral(cart.get("referred_code"), user, subtotal)
    return CartView(
        items=lines, item_count=sum(l.qty for l in lines if l.is_active), subtotal=subtotal,
        referred_code=ref["referred_code"], referral_status=ref["referral_status"],
        referral_discount=ref["referral_discount"], referral_note=ref["referral_note"],
    )


@router.get("/cart", response_model=CartView)
async def get_cart(request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    return await cart_view(cart, user)


@router.post("/cart/items", response_model=CartView)
async def add_item(input: CartItemIn, request: Request, response: Response, user=Depends(optional_user)):
    v = await db.variants.find_one({"id": input.variant_id, "is_active": True})
    if not v:
        raise HTTPException(status_code=404, detail="This variant is unavailable")
    p = await db.products.find_one({"id": v["product_id"], "is_active": True})
    if not p:
        raise HTTPException(status_code=404, detail="This product is unavailable")
    free_stock = max(0, int(v["stock"]) - int(v.get("reserved", 0)))
    if free_stock < input.qty:
        raise HTTPException(status_code=409, detail=f"Only {free_stock} unit(s) available right now")

    cart = await get_or_create_cart(request, response, user)
    items = {i["variant_id"]: i["qty"] for i in cart.get("items", [])}
    items[input.variant_id] = min(items.get(input.variant_id, 0) + input.qty, free_stock, 10)
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": [{"variant_id": k, "qty": q} for k, q in items.items()]}})
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)


@router.patch("/cart/items", response_model=CartView)
async def patch_item(input: CartItemPatch, request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    items = [i for i in cart.get("items", []) if i["variant_id"] != input.variant_id]
    if input.qty > 0:
        v = await db.variants.find_one({"id": input.variant_id})
        if not v:
            raise HTTPException(status_code=404, detail="Variant unavailable")
        free_stock = max(0, int(v["stock"]) - int(v.get("reserved", 0)))
        if input.qty > free_stock:
            raise HTTPException(status_code=409, detail=f"Only {free_stock} unit(s) available")
        items.append({"variant_id": input.variant_id, "qty": input.qty})
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"items": items}})
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)


@router.delete("/cart/items/{variant_id}", response_model=CartView)
async def remove_item(variant_id: str, request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    await db.carts.update_one(
        {"id": cart["id"]}, {"$set": {"items": [i for i in cart.get("items", []) if i["variant_id"] != variant_id]}}
    )
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)


@router.post("/cart/referral", response_model=CartView)
async def apply_referral(input: ReferralApplyIn, request: Request, response: Response, user=Depends(optional_user)):
    cart = await get_or_create_cart(request, response, user)
    code = (input.code or "").strip().upper() or None
    await db.carts.update_one({"id": cart["id"]}, {"$set": {"referred_code": code}})
    cart = await db.carts.find_one({"id": cart["id"]})
    return await cart_view(cart, user)
