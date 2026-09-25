"""Checkout: server-side repricing, stock reservation, Razorpay test-mode payments, webhooks.

Never trusts browser amounts. When Razorpay keys are absent the gateway state is
`pending_keys` — orders stay Awaiting payment and NO payment is ever faked.
"""

import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from lib.crm_intake import capture_checkout_started, convert_on_paid_order
from lib.db import db
from lib.security import normalize_email, now_utc, optional_user, audit, has_role
from lib.services import (
    consume_order_reservations,
    record_reward_ledger,
    reserve_stock,
)
from models.orders import CartView, CheckoutStartIn, VerifyPaymentIn
from routers.cart import cart_view, evaluate_referral, get_or_create_cart

router = APIRouter()
logger = logging.getLogger(__name__)

RAZORPAY_BASE = "https://api.razorpay.com/v1"


def rzp_creds() -> tuple[Optional[str], Optional[str]]:
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    ksec = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    return (kid, ksec) if kid and ksec else (None, None)


def rzp_mode() -> str:
    """Derive mode from key prefix — 'test' when rzp_test_..., 'live' when rzp_live_....
    Defaults to 'test' if key is missing (safe: no payments are taken without a key)."""
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    return "live" if kid.startswith("rzp_live_") else "test"


def gateway_state() -> str:
    kid = rzp_creds()[0]
    if not kid:
        return "pending_keys"
    return "ready_live" if kid.startswith("rzp_live_") else "ready_test"


class TrackIn(BaseModel):
    order_number: str = Field(min_length=3, max_length=32)
    email: str = Field(min_length=5, max_length=200)


@router.get("/checkout/config")
async def checkout_config():
    kid, _ = rzp_creds()
    state = gateway_state()
    # mode is derived from the actual key prefix — never hardcoded
    mode = rzp_mode() if state != "pending_keys" else "test"
    return {
        "gateway": "razorpay",
        "mode": mode,
        "state": state,
        "key_id": kid,  # public identifier — the secret never leaves the server
        "currency": "INR",
        "reservation_ttl_minutes": 15,
    }


@router.post("/checkout/start")
async def checkout_start(input: CheckoutStartIn, request: Request, user=Depends(optional_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}) if user else (
        await db.carts.find_one({"token": request.cookies.get("ks_cart"), "user_id": None})
        if request.cookies.get("ks_cart") else None
    )
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Your cart is empty")

    view: CartView = await cart_view(cart, user)
    if not view.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")
    if any(not line.is_active for line in view.items):
        raise HTTPException(status_code=409, detail="Some items in your cart are no longer available — remove them to continue")

    # referral: manual code may override a prefilled one BEFORE payment; post-purchase it is immutable
    code = (input.referral_code or view.referred_code or "").strip().upper() or None
    if code:
        ref = await evaluate_referral(code, user, view.subtotal)
        if ref["referral_status"] in ("invalid", "self"):
            raise HTTPException(status_code=422, detail=ref["referral_note"] or "This referral code cannot be used")
    else:
        ref = {"referred_code": None, "referral_status": "none", "referral_discount": 0}

    settings = await db.settings.find_one({"id": "site"}) or {}
    subtotal = view.subtotal
    discount = ref["referral_discount"]
    tax = 0
    tax_status = settings.get("gst_status", "pending_configuration")
    if settings.get("gst_rate") is not None:
        tax = round(subtotal * settings["gst_rate"] / 100)
        tax_status = "final"
    shipping = 0
    shipping_status = settings.get("shipping_status", "pending_configuration")
    if settings.get("shipping_flat_paise") is not None:
        shipping = int(settings["shipping_flat_paise"])
        shipping_status = "final"
    if settings.get("free_shipping_enabled"):
        shipping = 0
        shipping_status = "final"
    total = max(0, subtotal - discount + tax + shipping)

    while True:
        counter = await db.counters.find_one_and_update(
            {"_id": "order_number"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        candidate_num = f"KS{counter['seq']:05d}"
        if not await db.orders.find_one({"order_number": candidate_num}):
            break
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "order_number": candidate_num,
        "user_id": user["id"] if user else None,
        "email": normalize_email(input.address.email) if input.address.email else ((user.get("email") if user else None) or f"guest_{''.join(c for c in input.address.phone if c.isdigit())}@kotson.in"),
        "guest_access_token": str(uuid.uuid4()) if not user else None,
        "channel": "retail",
        "buyer_type": "DEALER" if (user and has_role(user, "dealer")) else "CUSTOMER",
        "order_source": "WEB_REFERRAL" if (ref.get("referred_code") and ref.get("referral_status") in ("valid", "no_published_rule")) else "DIRECT_WEBSITE",
        "order_channel": "WEBSITE",
        "sale_date": now_utc(),
        "payment_verification_source": "PAYMENT_GATEWAY",
        "employee_id": None,
        "dealer_id": user["id"] if (user and has_role(user, "dealer")) else None,
        "source_note": None,
        "cart_token": cart["token"],
        "items": [
            {
                "variant_id": l.variant_id, "product_id": l.product_id, "product_slug": l.product_slug,
                "product_name": l.product_name, "sku": l.sku, "size": l.size, "length": l.length, "width": l.width,
                "thickness": l.thickness, "firmness": l.firmness, "qty": l.qty,
                "unit_price": l.unit_price, "line_total": l.line_total,
                "mrp": l.mrp, "discount_amount": l.discount_amount, "discount_percent": l.discount_percent,
            }
            for l in view.items
        ],
        "address": input.address.model_dump(),
        "amounts": {
            "subtotal": subtotal, "total_mrp": view.total_mrp, "total_discount": view.total_discount,
            "discount": discount, "tax": tax, "tax_status": tax_status,
            "shipping": shipping, "shipping_status": shipping_status, "total": total,
        },
        "payment_status": "pending",
        "fulfilment_status": "awaiting_payment",
        "reservation_status": "active",
        "referral_code": ref["referred_code"] if ref["referral_status"] in ("valid", "no_published_rule") else None,
        "referred_by_user_id": None,
        "razorpay": {},
        "events": [{"at": now_utc(), "type": "order_created", "detail": "Order created; stock reserved", "actor": "system"}],
        "created_at": now_utc(),
    }
    if ref.get("referred_code"):
        owner = await db.users.find_one({"referral_code": ref["referred_code"]})
        order["referred_by_user_id"] = owner["id"] if owner else None
        order["order_source"] = "WEB_REFERRAL"

    try:
        await reserve_stock(order_id, [{"variant_id": l.variant_id, "qty": l.qty} for l in view.items])
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    await db.orders.insert_one(order)

    # CRM: checkout-started UPDATES the same opportunity — it never creates a duplicate lead.
    try:
        await capture_checkout_started(user, order)
    except Exception:
        logger.exception("CRM checkout-started intake failed for %s", order["id"])

    _gstate = gateway_state()
    _gmode = rzp_mode() if _gstate != "pending_keys" else "test"
    gateway: dict = {"state": _gstate, "mode": _gmode, "key_id": rzp_creds()[0], "rzp_order_id": None, "amount": total}
    if _gstate in ("ready_test", "ready_live"):
        kid, ksec = rzp_creds()
        try:
            async with httpx.AsyncClient(timeout=20) as hc:
                r = await hc.post(
                    f"{RAZORPAY_BASE}/orders",
                    auth=(kid, ksec),
                    json={"amount": total, "currency": "INR", "receipt": order["order_number"][:40], "payment_capture": 1},
                )
            if r.status_code in (200, 201):
                rzp = r.json()
                gateway["rzp_order_id"] = rzp["id"]
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"razorpay.order": {"id": rzp["id"], "amount": rzp["amount"], "currency": rzp["currency"], "receipt": rzp.get("receipt")}}},
                )
            else:
                gateway["state"] = "error"
                gateway["detail"] = "Razorpay rejected the order — retry shortly; the stock reservation expires safely."
                await db.orders.update_one(
                    {"id": order_id},
                    {"$push": {"events": {"at": now_utc(), "type": "razorpay_order_failed", "detail": f"HTTP {r.status_code}", "actor": "system"}}},
                )
        except httpx.HTTPError as exc:
            gateway["state"] = "error"
            gateway["detail"] = "Could not reach Razorpay — retry shortly."
            await db.orders.update_one(
                {"id": order_id},
                {"$push": {"events": {"at": now_utc(), "type": "razorpay_order_failed", "detail": str(exc)[:200], "actor": "system"}}},
            )
    return {
        "order_id": order_id,
        "order_number": order["order_number"],
        "guest_access_token": order["guest_access_token"],
        "amounts": order["amounts"],
        "gateway": gateway,
    }


async def finalize_order(order: dict, payment_meta: dict) -> dict:
    """The authoritative transition — runs exactly once (guarded pending -> paid)."""
    updated = await db.orders.find_one_and_update(
        {"id": order["id"], "payment_status": "pending"},
        {
            "$set": {"payment_status": "paid", "fulfilment_status": "processing", "paid_at": now_utc(),
                     "razorpay.payment": payment_meta, "razorpay.verified_at": now_utc()},
            "$push": {"events": {"at": now_utc(), "type": "payment_verified", "detail": "Payment verified server-side — order marked paid", "actor": "system"}},
        },
        return_document=True,
    )
    if not updated:
        return await db.orders.find_one({"id": order["id"]})  # already finalized: idempotent no-op

    # CRM: only a verified paid order converts an opportunity, and only once.
    try:
        await convert_on_paid_order(updated)
    except Exception:
        logger.exception("CRM paid-order conversion failed for %s", updated["id"])

    expected = sum(i["qty"] for i in updated["items"])
    moved = await consume_order_reservations(updated["id"])
    await db.orders.update_one({"id": updated["id"]}, {"$set": {"reservation_status": "consumed"}})
    if moved < expected:
        # Captured payment but stock could not be assigned: escalate, block fulfilment,
        # keep a documented refund/manual path. NEVER silently cancel or oversell.
        await db.orders.update_one(
            {"id": updated["id"]},
            {"$set": {"stock_exception": True, "fulfilment_blocked": True},
             "$push": {"events": {"at": now_utc(), "type": "stock_exception",
                                  "detail": f"Captured payment could not be allocated ({moved}/{expected} units). Fulfilment blocked pending refund/manual resolution.",
                                  "actor": "system"}}},
        )
        await audit(None, "stock.exception", "order", updated["id"], "captured payment without allocatable stock")

    # Referral attribution + referrer reward accrual (idempotent, pending until approved)
    if updated.get("referral_code"):
        owner = await db.users.find_one({"referral_code": updated["referral_code"]})
        if owner and owner["id"] != updated.get("user_id"):
            rule = await db.referral_rules.find_one(
                {"reward_type": "referrer_reward", "status": "published"}, sort=[("created_at", -1)]
            )
            if rule:
                skip = False
                if rule.get("first_order_only"):
                    prior = await db.orders.find_one(
                        {"email": updated["email"], "referral_code": updated["referral_code"],
                         "payment_status": "paid", "id": {"$ne": updated["id"]}}
                    )
                    skip = prior is not None
                if not skip:
                    basis = updated["amounts"]["subtotal"] - updated["amounts"].get("discount", 0)
                    value = basis * min(rule["value"], 100) // 100 if rule["value_type"] == "percent" else min(rule["value"], basis)
                    await record_reward_ledger(
                        {"id": str(uuid.uuid4()), "order_id": updated["id"], "order_number": updated["order_number"],
                         "user_id": owner["id"], "code": updated["referral_code"], "rule_id": rule["id"],
                         "type": "referrer_commission", "amount": value, "status": "pending"}
                    )

    # Clear purchased lines from the cart
    purchased_ids = [i["variant_id"] for i in updated["items"]]
    if updated.get("cart_token"):
        await db.carts.update_one({"token": updated["cart_token"]}, {"$pull": {"items": {"variant_id": {"$in": purchased_ids}}}})
    if updated.get("user_id"):
        await db.carts.update_one({"user_id": updated["user_id"]}, {"$pull": {"items": {"variant_id": {"$in": purchased_ids}}}})
    return updated


@router.post("/checkout/verify")
async def verify_payment(input: VerifyPaymentIn):
    kid, ksec = rzp_creds()
    if not kid:
        raise HTTPException(status_code=503, detail="Payment gateway is not configured — owner must add Razorpay test keys")
    order = await db.orders.find_one({"razorpay.order.id": input.razorpay_order_id})
    if not order:
        raise HTTPException(status_code=404, detail="No matching order for this payment")
    if order.get("payment_status") == "paid":
        return {"status": "already_paid", "order_number": order["order_number"], "order_id": order["id"],
                "guest_access_token": order.get("guest_access_token")}

    expected_sig = hmac.new(ksec.encode(), f"{input.razorpay_order_id}|{input.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, input.razorpay_signature):
        await db.orders.update_one(
            {"id": order["id"]},
            {"$push": {"events": {"at": now_utc(), "type": "signature_invalid", "detail": "Checkout signature verification failed", "actor": "system"}}},
        )
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    # Independent verification straight from the provider
    try:
        async with httpx.AsyncClient(timeout=20) as hc:
            pr = await hc.get(f"{RAZORPAY_BASE}/payments/{input.razorpay_payment_id}", auth=(kid, ksec))
    except httpx.HTTPError:
        pr = None
    if pr is None or pr.status_code != 200:
        # Browser callback is only a trigger — webhook/reconciliation remains the recovery path
        await db.orders.update_one(
            {"id": order["id"]},
            {"$push": {"events": {"at": now_utc(), "type": "verification_deferred", "detail": "Provider verification unavailable; awaiting webhook/reconciliation", "actor": "system"}}},
        )
        return {"status": "pending_verification", "order_number": order["order_number"], "order_id": order["id"],
                "guest_access_token": order.get("guest_access_token")}

    payment = pr.json()
    if (payment.get("order_id") != input.razorpay_order_id or payment.get("currency") != "INR"
            or int(payment.get("amount", -1)) != order["amounts"]["total"]
            or payment.get("status") not in ("captured", "authorized")):
        await db.orders.update_one(
            {"id": order["id"]},
            {"$push": {"events": {"at": now_utc(), "type": "verification_mismatch", "detail": f"Provider payment {payment.get('status')} amount={payment.get('amount')} currency={payment.get('currency')}", "actor": "system"}}},
        )
        raise HTTPException(status_code=400, detail="Payment details do not match this order")

    updated = await finalize_order(order, {
        "payment_id": input.razorpay_payment_id, "order_id": input.razorpay_order_id,
        "method": payment.get("method"), "amount": payment.get("amount"), "status": payment.get("status"), "via": "checkout_callback",
    })
    return {"status": "paid", "order_number": updated["order_number"], "order_id": updated["id"],
            "guest_access_token": updated.get("guest_access_token")}


@router.post("/checkout/webhook")
async def razorpay_webhook(request: Request):
    raw = await request.body()
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")
    sig = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_id = request.headers.get("X-Razorpay-Event-ID") or hashlib.sha256(raw).hexdigest()
    if await db.processed_events.find_one({"event_id": event_id}):
        return {"ok": True, "deduplicated": True}
    await db.processed_events.insert_one({"event_id": event_id, "created_at": now_utc()})

    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Malformed webhook body")
    event = body.get("event", "")
    payload = body.get("payload", {})

    rzp_order_id = None
    payment_id = None
    if "payment" in payload:
        entity = payload["payment"]["entity"]
        payment_id = entity.get("id")
        rzp_order_id = entity.get("order_id")
    if "order" in payload:
        rzp_order_id = payload["order"]["entity"].get("id") or rzp_order_id

    if event in ("payment.captured", "order.paid") and rzp_order_id:
        order = await db.orders.find_one({"razorpay.order.id": rzp_order_id})
        if order and order.get("payment_status") == "pending":
            # Re-verify against the provider before trusting the webhook body
            kid, ksec = rzp_creds()
            verified_meta = {"payment_id": payment_id, "order_id": rzp_order_id, "via": "webhook", "event": event}
            if kid and payment_id:
                try:
                    async with httpx.AsyncClient(timeout=20) as hc:
                        pr = await hc.get(f"{RAZORPAY_BASE}/payments/{payment_id}", auth=(kid, ksec))
                    if pr.status_code == 200:
                        p = pr.json()
                        verified_meta |= {"amount": p.get("amount"), "status": p.get("status"), "method": p.get("method")}
                except httpx.HTTPError:
                    pass
            await finalize_order(order, verified_meta)
    elif event == "payment.failed" and rzp_order_id:
        await db.orders.update_one(
            {"razorpay.order.id": rzp_order_id, "payment_status": "pending"},
            {"$push": {"events": {"at": now_utc(), "type": "payment_failed", "detail": "Provider reported failed payment; order remains awaiting payment", "actor": "system"}}},
        )
    return {"ok": True}


@router.post("/track-order")
async def track_order(input: TrackIn):
    o = await db.orders.find_one({"order_number": input.order_number.strip().upper(), "email": normalize_email(input.email)})
    if not o:
        raise HTTPException(status_code=404, detail="No order found for that order number and email")
    return {
        "order_number": o["order_number"],
        "payment_status": o["payment_status"],
        "fulfilment_status": o["fulfilment_status"],
        "placed_at": o["created_at"].replace(tzinfo=None) if isinstance(o["created_at"], datetime) else o["created_at"],
        "items": [{"product_name": i["product_name"], "qty": i["qty"]} for i in o["items"]],
        "events": [{"type": e["type"], "detail": e.get("detail", ""), "at": e.get("at")} for e in o.get("events", [])][-5:],
    }
