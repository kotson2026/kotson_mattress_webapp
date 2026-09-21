"""Owner/admin console backend: dashboard, staff, settings (masked integration state), audit, rewards."""

import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.security import (
    ADMIN,
    OWNER,
    STAFF_ROLES,
    audit,
    hash_password,
    normalize_email,
    now_utc,
    require_role,
)
from lib.services import clean_doc
from models.content import SettingsOut, SettingsUpdate
from models.users import StaffInviteIn, StaffUpdateIn, UserOut

router = APIRouter()


@router.get("/admin/dashboard")
async def dashboard(user=Depends(require_role("owner", "admin", "manager"))):
    tzname = os.environ.get("APP_TZ", "Asia/Kolkata")
    tz = ZoneInfo(tzname)
    now_local = datetime.now(tz)
    today_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    week_start = today_start - timedelta(days=6)

    paid = {"payment_status": "paid"}
    rev = await db.orders.aggregate([
        {"$match": paid},
        {"$group": {"_id": None, "revenue": {"$sum": "$amounts.total"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    today = await db.orders.count_documents({**paid, "created_at": {"$gte": today_start}})
    week = await db.orders.count_documents({**paid, "created_at": {"$gte": week_start}})
    pending = await db.orders.count_documents({"payment_status": "pending", "fulfilment_status": "awaiting_payment"})
    exceptions = await db.orders.count_documents({"stock_exception": True, "fulfilment_blocked": True})

    trend_rows = await db.orders.aggregate([
        {"$match": {**paid, "created_at": {"$gte": week_start}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": tzname}},
                    "revenue": {"$sum": "$amounts.total"}, "orders": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(10)

    low_variants = await db.variants.aggregate([
        {"$match": {"$expr": {"$lte": [{"$subtract": ["$stock", "$reserved"]}, 5]}}},
        {"$limit": 25},
    ]).to_list(25)
    low_stock = []
    for v in low_variants:
        p = await db.products.find_one({"id": v["product_id"]})
        low_stock.append({"sku": v["sku"], "product_name": p["name"] if p else "", "size": v["size"],
                          "free_stock": max(0, v["stock"] - v.get("reserved", 0))})

    return {
        "revenue_paid_paise": rev[0]["revenue"] if rev else 0,
        "paid_orders": rev[0]["count"] if rev else 0,
        "orders_today": today,
        "orders_week": week,
        "awaiting_payment": pending,
        "stock_exceptions": exceptions,
        "low_stock": low_stock,
        "trend": [{"date": r["_id"], "revenue_paise": r["revenue"], "orders": r["orders"]} for r in trend_rows],
        "timezone": tzname,
    }


@router.get("/admin/staff", response_model=List[UserOut], dependencies=[])
async def staff_list(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.users.find({"roles": {"$in": STAFF_ROLES}}).sort("created_at", -1).to_list(200)
    return [UserOut(**clean_doc(d)) for d in docs]


@router.post("/admin/staff/invite")
async def staff_invite(input: StaffInviteIn, user=Depends(require_role(OWNER))):
    email = normalize_email(str(input.email))
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    bad = [r for r in input.roles if r not in STAFF_ROLES]
    if bad:
        raise HTTPException(status_code=422, detail=f"Unknown staff roles: {', '.join(bad)}")
    one_time_password = secrets.token_urlsafe(12)
    doc = {
        "id": str(uuid.uuid4()), "email": email, "name": input.name,
        "password_hash": hash_password(one_time_password), "roles": input.roles,
        "referral_code": None, "is_active": True, "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    await audit(user, "staff.invite", "user", doc["id"], f"roles={input.roles}")
    return {
        "ok": True, "email": email, "one_time_password": one_time_password,
        "note": "Mail provider is pending — share these credentials securely and have the staff member rotate the password at first sign-in.",
    }


@router.patch("/admin/staff/{uid}", response_model=UserOut)
async def staff_update(uid: str, input: StaffUpdateIn, user=Depends(require_role(OWNER))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if "roles" in patch:
        bad = [r for r in patch["roles"] if r not in STAFF_ROLES]
        if bad:
            raise HTTPException(status_code=422, detail=f"Unknown staff roles: {', '.join(bad)}")
    doc = await db.users.find_one_and_update({"id": uid}, {"$set": patch}, return_document=True)
    if not doc:
        raise HTTPException(status_code=404, detail="Staff member not found")
    await audit(user, "staff.update", "user", uid, str(patch))
    return UserOut(**clean_doc(doc))


@router.get("/admin/settings", response_model=SettingsOut)
async def get_settings(user=Depends(require_role("owner", "admin", "manager"))):
    s = await db.settings.find_one({"id": "site"}) or {}
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    out = SettingsOut(**clean_doc(s)) if s.get("id") else SettingsOut()
    out.razorpay_state = "ready_test_mode" if kid else "pending_keys"
    return out


@router.put("/admin/settings", response_model=SettingsOut)
async def put_settings(input: SettingsUpdate, user=Depends(require_role(OWNER, ADMIN))):
    patch = {k: v for k, v in input.model_dump().items() if v is not None}
    if "gst_rate" in patch and patch["gst_rate"] is not None and not (0 <= patch["gst_rate"] <= 28):
        raise HTTPException(status_code=422, detail="GST rate must be between 0 and 28%")
    await db.settings.update_one({"id": "site"}, {"$set": patch, "$setOnInsert": {"id": "site"}}, upsert=True)
    await audit(user, "settings.update", "settings", "site", str(patch))
    s = await db.settings.find_one({"id": "site"}) or {}
    out = SettingsOut(**clean_doc(s))
    kid = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    out.razorpay_state = "ready_test_mode" if kid else "pending_keys"
    return out


@router.get("/admin/audit", dependencies=[])
async def audit_log(limit: int = 50, user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.audit_log.find({}).sort("created_at", -1).to_list(min(limit, 200))
    return [{"id": d["id"], "actor_email": d.get("actor_email"), "action": d["action"], "entity": d["entity"],
             "entity_id": d["entity_id"], "detail": d.get("detail", ""), "created_at": d["created_at"]} for d in docs]


@router.get("/admin/rewards", dependencies=[])
async def rewards_list(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.reward_ledger.find({}).sort("created_at", -1).to_list(300)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/rewards/{rid}")
async def reward_update(rid: str, input: dict, user=Depends(require_role(OWNER))):
    status = input.get("status")
    if status not in ("approved", "reversed", "paid"):
        raise HTTPException(status_code=422, detail="status must be approved | reversed | paid")
    doc = await db.reward_ledger.find_one_and_update({"id": rid}, {"$set": {"status": status, "resolved_by": user["email"], "resolved_at": now_utc()}})
    if not doc:
        raise HTTPException(status_code=404, detail="Reward entry not found")
    await audit(user, "reward.update", "reward", rid, f"-> {status} (manual bank transfer confirmation; no payout integration)")
    return {"ok": True, "status": status}


@router.get("/admin/affiliates", dependencies=[])
async def affiliates_list(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.affiliates.find({}).sort("created_at", -1).to_list(200)
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@router.patch("/admin/affiliates/{aid}")
async def affiliate_update(aid: str, input: dict, user=Depends(require_role(OWNER, ADMIN))):
    status = input.get("status")
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be approved | rejected")
    doc = await db.affiliates.find_one_and_update({"id": aid}, {"$set": {"status": status}})
    if not doc:
        raise HTTPException(status_code=404, detail="Affiliate application not found")
    if status == "approved":
        await db.users.update_one({"id": doc["user_id"]}, {"$addToSet": {"roles": "affiliate"}})
    await audit(user, "affiliate.update", "affiliate", aid, f"-> {status}")
    return {"ok": True, "status": status}
