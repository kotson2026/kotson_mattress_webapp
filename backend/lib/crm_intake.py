"""CRM intake service — the single place source events become leads.

Rules enforced here (Section F of the brief):
  * `event_key` is unique, so a webhook/UI retry can never create a second lead.
  * Verified signup  -> exactly ONE registration lead, labelled `registered` (not sales-qualified).
  * Add-to-cart      -> at most ONE open cart opportunity per identified customer; later adds,
                        quantity changes and checkout-started UPDATE that same lead.
  * Guests with no contact details never become callable leads — the event is still recorded.
  * Only a verified PAID order converts an eligible opportunity, exactly once.
  * Identity dedup: authenticated customer_id first, then conservative normalized email/phone.
"""

import logging
import re
from typing import Optional

from pymongo.errors import DuplicateKeyError

from lib.db import db
from lib.security import now_utc
from models.crm import Lead, SourceEvent

logger = logging.getLogger(__name__)

INTAKE_PIPELINE_CODE = "intake"


def norm_email(v: Optional[str]) -> Optional[str]:
    return v.strip().lower() if v and v.strip() else None


def norm_phone(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    digits = re.sub(r"\D", "", v)
    return digits[-10:] if len(digits) >= 10 else None


async def _next_number(counter: str, prefix: str) -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": counter}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return f"{prefix}{doc['seq']:05d}"


async def _intake_pipeline_id() -> Optional[str]:
    p = await db.pipelines.find_one({"code": INTAKE_PIPELINE_CODE, "is_active": True})
    return p["id"] if p else None


async def _default_master_id() -> Optional[str]:
    """Owner-configurable routing target. Falls back to the Owner intake queue (None)."""
    s = await db.settings.find_one({"id": "site"}) or {}
    configured = (s.get("crm") or {}).get("default_master_id")
    if configured and await db.users.find_one({"id": configured, "is_active": True}):
        return configured
    m = await db.users.find_one({"roles": "crm_master", "is_active": True})
    return m["id"] if m else None


async def record_source_event(**kw) -> Optional[dict]:
    """Append-only + idempotent. Returns the stored event, or None when it was a duplicate."""
    event = SourceEvent(**kw)
    try:
        await db.source_events.insert_one(event.model_dump())
    except DuplicateKeyError:
        return None  # retry of an event we already processed
    return event.model_dump()


async def find_existing_lead(
    customer_id: Optional[str], email: Optional[str], phone: Optional[str], kind: Optional[str] = None
) -> Optional[dict]:
    """Dedup: authenticated id first, then conservative contact match."""
    base: dict = {"is_open": True}
    if kind:
        base["kind"] = kind
    if customer_id:
        found = await db.leads.find_one({**base, "customer_id": customer_id})
        if found:
            return found
    ors = []
    if email:
        ors.append({"email": email})
    if phone:
        ors.append({"phone": phone})
    if ors:
        return await db.leads.find_one({**base, "$or": ors})
    return None


async def _create_lead(**kw) -> dict:
    lead = Lead(lead_number=await _next_number("lead_number", "L"), **kw)
    doc = lead.model_dump()
    doc["master_id"] = doc.get("master_id") or await _default_master_id()
    doc["assignment_history"] = [
        {"at": now_utc(), "actor": "system", "master_id": doc["master_id"], "reason": "auto-routed on intake"}
    ]
    await db.leads.insert_one(doc)
    return doc


async def capture_registration(user: dict) -> Optional[dict]:
    """Verified signup -> exactly one registration lead. Repeat login/profile edit adds nothing."""
    event = await record_source_event(
        event_key=f"registration:{user['id']}",
        kind="registration",
        customer_id=user["id"],
        email=norm_email(user.get("email")),
        referral_code=user.get("referred_by"),
        payload={"name": user.get("name")},
    )
    if not event:
        return None
    existing = await db.leads.find_one({"customer_id": user["id"], "kind": "registration"})
    if existing:
        return existing
    return await _create_lead(
        kind="registration",
        customer_id=user["id"],
        name=user.get("name") or user["email"],
        email=norm_email(user.get("email")),
        pipeline_id=await _intake_pipeline_id(),
        stage_code="new",
        qualification="registered",  # explicitly NOT sales-qualified
        source_kind="registration",
        source_event_ids=[event["id"]],
    )


async def capture_cart_intent(user: Optional[dict], cart: dict, variant: dict, product: dict) -> Optional[dict]:
    """Add-to-cart. Identified customers only become callable leads; guests are recorded but not called."""
    customer_id = user["id"] if user else None
    event = await record_source_event(
        # keyed per cart so quantity changes update rather than duplicate
        event_key=f"cart_intent:{customer_id or cart['id']}:{cart['id']}",
        kind="cart_intent",
        customer_id=customer_id,
        guest_session=None if customer_id else cart.get("token"),
        email=norm_email(user.get("email")) if user else None,
        variant_id=variant["id"],
        product_name=product.get("name"),
        cart_id=cart["id"],
        referral_code=cart.get("referred_code"),
    )
    if not customer_id:
        return None  # an anonymous cart is not a callable person
    open_lead = await db.leads.find_one(
        {"customer_id": customer_id, "kind": "cart_opportunity", "is_open": True}
    )
    if open_lead:
        await db.leads.update_one(
            {"id": open_lead["id"]},
            {
                "$set": {
                    "product_interest": product.get("name"),
                    "cart_id": cart["id"],
                    "updated_at": now_utc(),
                },
                **({"$addToSet": {"source_event_ids": event["id"]}} if event else {}),
            },
        )
        return await db.leads.find_one({"id": open_lead["id"]})
    return await _create_lead(
        kind="cart_opportunity",
        customer_id=customer_id,
        name=user.get("name") or user.get("email"),
        email=norm_email(user.get("email")),
        pipeline_id=await _intake_pipeline_id(),
        stage_code="new",
        qualification="cart_intent",
        source_kind="cart_intent",
        source_event_ids=[event["id"]] if event else [],
        product_interest=product.get("name"),
        cart_id=cart["id"],
    )


async def capture_checkout_started(user: Optional[dict], order: dict) -> None:
    """Updates the SAME opportunity — never creates a duplicate lead."""
    customer_id = user["id"] if user else None
    event = await record_source_event(
        event_key=f"checkout_started:{order['id']}",
        kind="checkout_started",
        customer_id=customer_id,
        email=norm_email(order.get("email")),
        phone=norm_phone((order.get("address") or {}).get("phone")),
        order_id=order["id"],
        referral_code=(order.get("referral") or {}).get("code"),
    )
    if not customer_id or not event:
        return
    lead = await db.leads.find_one({"customer_id": customer_id, "kind": "cart_opportunity", "is_open": True})
    if lead:
        await db.leads.update_one(
            {"id": lead["id"]},
            {"$set": {"updated_at": now_utc()}, "$addToSet": {"source_event_ids": event["id"]}},
        )


async def capture_contact(kind: str, name: str, email: Optional[str], phone: Optional[str], subject: str, ref_id: str) -> Optional[dict]:
    """Contact / consultation / dealer inquiry -> a properly sourced lead."""
    event = await record_source_event(
        event_key=f"{kind}:{ref_id}",
        kind="dealer_inquiry" if kind == "dealer_inquiry" else "contact",
        email=norm_email(email),
        phone=norm_phone(phone),
        payload={"subject": subject, "name": name},
    )
    if not event:
        return None
    existing = await find_existing_lead(None, norm_email(email), norm_phone(phone), kind="sales")
    if existing:
        await db.leads.update_one(
            {"id": existing["id"]},
            {"$set": {"updated_at": now_utc()}, "$addToSet": {"source_event_ids": event["id"]}},
        )
        return existing
    return await _create_lead(
        kind="dealer" if kind == "dealer_inquiry" else "sales",
        name=name,
        email=norm_email(email),
        phone=norm_phone(phone),
        pipeline_id=await _intake_pipeline_id(),
        stage_code="new",
        qualification="sales_qualified",  # an inbound enquiry is a real sales conversation
        source_kind="dealer_inquiry" if kind == "dealer_inquiry" else "contact",
        source_event_ids=[event["id"]],
        product_interest=subject,
    )


async def convert_on_paid_order(order: dict) -> None:
    """ONLY a verified paid order converts, and only once (idempotent on event_key)."""
    event = await record_source_event(
        event_key=f"paid_order:{order['id']}",
        kind="cart_intent",
        customer_id=order.get("user_id"),
        email=norm_email(order.get("email")),
        order_id=order["id"],
        referral_code=(order.get("referral") or {}).get("code"),
        payload={"order_number": order.get("order_number")},
    )
    if not event:
        return
    customer_id = order.get("user_id")
    if not customer_id:
        return
    lead = await db.leads.find_one(
        {"customer_id": customer_id, "kind": "cart_opportunity", "is_open": True}
    ) or await db.leads.find_one({"customer_id": customer_id, "is_open": True, "kind": "sales"})
    if not lead or lead.get("converted_order_id"):
        return
    await db.leads.update_one(
        {"id": lead["id"], "converted_order_id": None},
        {
            "$set": {
                "qualification": "converted",
                "converted_order_id": order["id"],
                "converted_at": now_utc(),
                "is_open": False,
                "updated_at": now_utc(),
            },
            "$push": {
                "stage_history": {
                    "at": now_utc(),
                    "from": lead.get("stage_code"),
                    "to": "won",
                    "actor": "system",
                    "reason": f"verified paid order {order.get('order_number')}",
                }
            },
            "$addToSet": {"source_event_ids": event["id"]},
        },
    )
    await db.leads.update_one({"id": lead["id"]}, {"$set": {"stage_code": "won"}})


async def merge_guest_history(customer_id: str, guest_token: Optional[str]) -> None:
    """At sign-in, attach guest source events to the customer without creating duplicate leads."""
    if not guest_token:
        return
    await db.source_events.update_many(
        {"guest_session": guest_token, "customer_id": None},
        {"$set": {"customer_id": customer_id}},
    )
