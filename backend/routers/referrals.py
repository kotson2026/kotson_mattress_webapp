"""Referrals, affiliates and the v1 referral-rule engine.

Safe default: 0 discount / 0 commission until the owner publishes a rule. A referral
code is an eligibility/attribution key, never an automatic monetary discount.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import os

from lib.db import db
from lib.security import OWNER, audit, now_utc, require_role, require_user
from lib.services import clean_doc as svc_clean
from models.content import ReferralRule, ReferralRuleIn, ReferralRulePatch

router = APIRouter()


class ClickIn(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    path: str = Field(default="/", max_length=300)


@router.get("/referrals/me")
async def referrals_me(user=Depends(require_user)):
    code = user.get("referral_code")
    base = os.environ.get("APP_URL", "").rstrip("/") or "https://kotsonmattress.com"
    clicks = await db.referral_clicks.count_documents({"code": code}) if code else 0
    attributed = await db.referral_attributions.count_documents({"code": code}) if code else 0
    qualified = await db.orders.count_documents({"referral_code": code, "payment_status": "paid"}) if code else 0
    rewards = await db.reward_ledger.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    rules = await db.referral_rules.find({"status": "published"}).to_list(20)
    return {
        "referral_code": code,
        "share_url": f"{base}/r/{code}" if code else None,
        "clicks": clicks,
        "attributed_signups": attributed,
        "qualified_orders": qualified,
        "rewards": [{"id": r["id"], "order_number": r.get("order_number"), "type": r["type"],
                     "amount": r["amount"], "status": r["status"], "created_at": r["created_at"]} for r in rewards],
        "published_rules": [{"name": r["name"], "reward_type": r["reward_type"], "value_type": r["value_type"],
                             "value": r["value"], "min_spend_paise": r.get("min_spend_paise", 0),
                             "first_order_only": r.get("first_order_only", True)} for r in rules],
        "economics_configured": len(rules) > 0,
        "policy": "A referral code records attribution only. Discounts or rewards apply strictly per a published owner rule; nothing is promised until economics and T&Cs are configured.",
    }


@router.post("/referrals/click")
async def referral_click(input: ClickIn):
    """Consent-aware click attribution: code + path + timestamp only, no PII, no fingerprinting."""
    code = input.code.strip().upper()
    if not await db.users.find_one({"referral_code": code, "is_active": True}):
        return {"ok": False, "reason": "unknown code"}
    await db.referral_clicks.insert_one(
        {"id": str(uuid.uuid4()), "code": code, "path": input.path, "created_at": now_utc()}
    )
    return {"ok": True}


@router.get("/referrals/rules")
async def public_rules():
    docs = await db.referral_rules.find({"status": "published"}).to_list(20)
    return [{"name": r["name"], "reward_type": r["reward_type"], "value_type": r["value_type"],
             "value": r["value"], "min_spend_paise": r.get("min_spend_paise", 0),
             "first_order_only": r.get("first_order_only", True),
             "attribution_window_days": r.get("attribution_window_days", 30)} for r in docs]


@router.post("/affiliates/apply", status_code=201)
async def affiliate_apply(user=Depends(require_user)):
    existing = await db.affiliates.find_one({"user_id": user["id"]})
    if existing:
        return {k: v for k, v in existing.items() if k != "_id"}
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "status": "applied",
           "campaign_status": "pending_configuration", "created_at": now_utc()}
    await db.affiliates.insert_one(doc)
    await audit(user, "affiliate.apply", "affiliate", doc["id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/affiliates/me")
async def affiliates_me(user=Depends(require_user)):
    doc = await db.affiliates.find_one({"user_id": user["id"]})
    if not doc:
        return {"applied": False, "status": None, "campaign_status": "pending_configuration",
                "note": "Affiliate economics are pending owner configuration — no commission is promised."}
    rewards = await db.reward_ledger.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    return {"applied": True, "status": doc["status"], "campaign_status": doc.get("campaign_status"),
            "rewards": [{k: v for k, v in r.items() if k != "_id"} for r in rewards]}


# ---------- owner/admin: the referral-rule engine ----------

@router.get("/admin/referral-rules", response_model=list[ReferralRule], dependencies=[])
async def admin_rules(user=Depends(require_role(OWNER, "admin"))):
    docs = await db.referral_rules.find({}).sort("created_at", -1).to_list(50)
    return [ReferralRule(**svc_clean(d)) for d in docs]


@router.post("/admin/referral-rules", response_model=ReferralRule, status_code=201)
async def admin_create_rule(input: ReferralRuleIn, user=Depends(require_role(OWNER, "admin"))):
    doc = input.model_dump() | {"id": str(uuid.uuid4()), "status": "draft", "created_at": now_utc()}
    await db.referral_rules.insert_one(doc)
    await audit(user, "referral_rule.create", "rule", doc["id"], f"{input.name} (draft)")
    return ReferralRule(**doc)


@router.patch("/admin/referral-rules/{rid}", response_model=ReferralRule)
async def admin_patch_rule(rid: str, input: ReferralRulePatch, user=Depends(require_role(OWNER, "admin"))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    doc = await db.referral_rules.find_one_and_update({"id": rid}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Rule not found")
    await audit(user, "referral_rule.update", "rule", rid, str(patch))
    return ReferralRule(**svc_clean(doc))
