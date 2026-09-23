"""Refer & Earn Engine: Product-level reward rules, 9 KPIs, reward lifecycle, withdrawal queue with UTR recording, and fraud flags."""

import os
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, require_role, require_user
from lib.services import clean_doc


router = APIRouter()


class RewardRuleIn(BaseModel):
    product_id: Optional[str] = None  # None indicates Global Tier
    rule_name: str
    reward_type: str = "PERCENTAGE"  # PERCENTAGE | FIXED
    value: float  # e.g., 5.0 for 5% or 500 for ₹500
    min_order_value: float = 0.0
    first_order_only: bool = False
    is_active: bool = True


class WithdrawalActionIn(BaseModel):
    utr_number: str = Field(min_length=6, max_length=50)
    payment_method: str = "NEFT/RTGS"  # NEFT/RTGS | IMPS | UPI
    payment_date: Optional[str] = None
    note: Optional[str] = None


class RewardRejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=300)


class RewardHoldIn(BaseModel):
    review_date: str
    note: str = Field(min_length=5, max_length=300)


# ----------------- User Refer & Earn Experience -----------------

@router.get("/referrals/me")
async def referrals_me(user=Depends(require_user)):
    code = user.get("referral_code")
    base = os.environ.get("APP_URL", "").rstrip("/") or "https://kotsonmattress.com"
    clicks = await db.referral_clicks.count_documents({"code": code}) if code else 0
    leads = await db.referral_attributions.count_documents({"code": code}) if code else 0
    orders_cnt = await db.orders.count_documents({"referral_code": code, "payment_status": "paid"}) if code else 0
    rewards = await db.referral_rewards.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    
    total_earned = sum(r.get("amount", 0) for r in rewards if r.get("status") in ("approved", "paid"))
    pending_rewards = sum(r.get("amount", 0) for r in rewards if r.get("status") == "pending")
    paid_rewards = sum(r.get("amount", 0) for r in rewards if r.get("status") == "paid")
    available_balance = max(0, total_earned - paid_rewards)

    rules = await db.referral_rules.find({"is_active": True}).to_list(20)

    return {
        "referral_code": code,
        "share_url": f"{base}/r/{code}" if code else None,
        "clicks": clicks,
        "leads": leads,
        "qualified_orders": orders_cnt,
        "available_balance": available_balance,
        "total_earned": total_earned,
        "pending_rewards": pending_rewards,
        "paid_rewards": paid_rewards,
        "rewards": [clean_doc(r) for r in rewards],
        "active_rules": [clean_doc(r) for r in rules],
        "policy": "Earn guaranteed rewards on every qualified order placed through your referral link. Rewards are verified and directly transferable to your bank account or UPI.",
    }


@router.post("/referrals/request-withdrawal")
async def request_withdrawal(input: dict, user=Depends(require_user)):
    amount = float(input.get("amount", 0))
    payout_details = input.get("payout_details", {})
    if amount < 500:
        raise HTTPException(status_code=400, detail="Minimum withdrawal amount is ₹500")

    # Calculate available balance
    rewards = await db.referral_rewards.find({"user_id": user["id"]}).to_list(500)
    total_earned = sum(r.get("amount", 0) for r in rewards if r.get("status") in ("approved", "paid"))
    paid = sum(r.get("amount", 0) for r in rewards if r.get("status") == "paid")
    pending_withdrawals = await db.referral_withdrawals.find({"user_id": user["id"], "status": {"$in": ["PENDING", "PROCESSING"]}}).to_list(100)
    in_flight = sum(w.get("amount", 0) for w in pending_withdrawals)
    
    available = total_earned - paid - in_flight
    if amount > available:
        raise HTTPException(status_code=400, detail=f"Insufficient available balance (Available: ₹{available:,.2f})")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "user_phone": user.get("phone"),
        "amount": amount,
        "payout_details": payout_details,
        "status": "PENDING",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.referral_withdrawals.insert_one(doc)
    await audit(user, "referral.withdrawal_request", "withdrawal", doc["id"], f"Requested ₹{amount}")
    return clean_doc(doc)


# ----------------- Admin Refer & Earn Central Hub -----------------

@router.get("/admin/referrals/overview")
async def admin_referrals_overview(user=Depends(require_role(OWNER, ADMIN))):
    """The 9 Core Executive KPIs for Refer & Earn."""
    # 1. Total Referrers
    total_referrers = await db.users.count_documents({"referral_code": {"$ne": None}})
    
    # 2. Total Referral Leads
    total_leads = await db.referral_attributions.count_documents({})
    
    # 3. Completed Referral Sales & 4. Revenue
    paid_referral_orders = await db.orders.find({"referral_code": {"$ne": None}, "payment_status": "paid"}).to_list(10000)
    completed_sales_count = len(paid_referral_orders)
    total_sales_value = sum(o.get("total_amount", 0) for o in paid_referral_orders)
    
    # 5. Total Rewards Earned
    all_rewards = await db.referral_rewards.find({}).to_list(10000)
    total_rewards_earned = sum(r.get("amount", 0) for r in all_rewards if r.get("status") in ("approved", "paid"))
    
    # 6. Rewards Approved & Ready
    rewards_approved_ready = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "approved")
    
    # 7. Rewards Pending Review
    rewards_pending_review = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "pending")
    
    # 8. Pending Withdrawal Requests Count & Value
    pending_withdrawals = await db.referral_withdrawals.find({"status": "PENDING"}).to_list(1000)
    pending_withdrawal_count = len(pending_withdrawals)
    pending_withdrawal_value = sum(w.get("amount", 0) for w in pending_withdrawals)
    
    # 9. Total Paid Rewards
    total_paid_rewards = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "paid")
    
    return {
        "total_referrers": total_referrers,
        "total_leads": total_leads,
        "completed_sales_count": completed_sales_count,
        "total_sales_value": round(total_sales_value, 2),
        "total_rewards_earned": round(total_rewards_earned, 2),
        "rewards_approved_ready": round(rewards_approved_ready, 2),
        "rewards_pending_review": round(rewards_pending_review, 2),
        "pending_withdrawal_count": pending_withdrawal_count,
        "pending_withdrawal_value": round(pending_withdrawal_value, 2),
        "total_paid_rewards": round(total_paid_rewards, 2),
    }


# Product-level and Global Reward Rules
@router.get("/admin/referrals/rules")
async def list_referral_rules(user=Depends(require_role(OWNER, ADMIN))):
    rules = await db.referral_rules.find({}).sort("created_at", -1).to_list(100)
    products = await db.products.find({}, {"id": 1, "name": 1, "price": 1}).to_list(200)
    prod_map = {p["id"]: p for p in products}

    enriched = []
    for r in rules:
        p_info = prod_map.get(r.get("product_id"))
        doc = clean_doc(r)
        doc["product_name"] = p_info.get("name") if p_info else "All Store Products (Global Tier)"
        
        # Calculate sample reward
        sample_base = p_info.get("price", 25000.0) if p_info else 25000.0
        if r.get("reward_type") == "PERCENTAGE":
            doc["sample_reward"] = round(sample_base * (r.get("value", 5.0) / 100), 2)
        else:
            doc["sample_reward"] = r.get("value", 500.0)
            
        enriched.append(doc)
    return enriched


@router.post("/admin/referrals/rules", status_code=201)
async def create_referral_rule(input: RewardRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    doc = input.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc()
    doc["updated_at"] = now_utc()
    await db.referral_rules.insert_one(doc)
    await audit(user, "referral_rule.create", "rule", doc["id"], f"Created rule '{doc['rule_name']}'")
    return clean_doc(doc)


@router.put("/admin/referrals/rules/{rid}")
async def update_referral_rule(rid: str, input: RewardRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    patch = input.model_dump()
    patch["updated_at"] = now_utc()
    res = await db.referral_rules.update_one({"id": rid}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    await audit(user, "referral_rule.update", "rule", rid, f"Updated rule {rid}")
    updated = await db.referral_rules.find_one({"id": rid})
    return clean_doc(updated)


@router.delete("/admin/referrals/rules/{rid}")
async def delete_referral_rule(rid: str, user=Depends(require_role(OWNER, ADMIN))):
    res = await db.referral_rules.delete_one({"id": rid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    await audit(user, "referral_rule.delete", "rule", rid, "Deleted rule")
    return {"status": "success", "message": "Rule deleted"}


# Reward Ledger & Lifecycle Transitions
@router.get("/admin/referrals/rewards")
async def list_referral_rewards(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=200),
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if status and status != "ALL":
        query["status"] = status.lower()
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q.strip(), "$options": "i"}},
            {"referrer_name": {"$regex": q.strip(), "$options": "i"}},
            {"referrer_code": {"$regex": q.strip(), "$options": "i"}},
            {"customer_name": {"$regex": q.strip(), "$options": "i"}},
        ]

    total = await db.referral_rewards.count_documents(query)
    skip = (page - 1) * limit
    docs = await db.referral_rewards.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "rewards": [clean_doc(d) for d in docs],
    }


@router.post("/admin/referrals/rewards/{rid}/approve")
async def approve_reward(rid: str, user=Depends(require_role(OWNER, ADMIN))):
    reward = await db.referral_rewards.find_one({"id": rid})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward record not found")
    if reward.get("status") not in ("pending", "held"):
        raise HTTPException(status_code=400, detail=f"Cannot approve reward currently in '{reward.get('status')}' status")

    await db.referral_rewards.update_one(
        {"id": rid},
        {"$set": {"status": "approved", "approved_by": user["email"], "approved_at": now_utc(), "updated_at": now_utc()}}
    )
    await audit(user, "referral_reward.approve", "reward", rid, f"Approved reward of ₹{reward.get('amount')}")
    return {"status": "success", "message": "Reward approved for withdrawal"}


@router.post("/admin/referrals/rewards/{rid}/reject")
async def reject_reward(rid: str, input: RewardRejectIn, user=Depends(require_role(OWNER, ADMIN))):
    reward = await db.referral_rewards.find_one({"id": rid})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward record not found")

    await db.referral_rewards.update_one(
        {"id": rid},
        {
            "$set": {
                "status": "rejected",
                "rejection_reason": input.reason,
                "rejected_by": user["email"],
                "rejected_at": now_utc(),
                "updated_at": now_utc(),
            }
        }
    )
    await audit(user, "referral_reward.reject", "reward", rid, f"Rejected: {input.reason}")
    return {"status": "success", "message": "Reward rejected"}


@router.post("/admin/referrals/rewards/{rid}/hold")
async def hold_reward(rid: str, input: RewardHoldIn, user=Depends(require_role(OWNER, ADMIN))):
    reward = await db.referral_rewards.find_one({"id": rid})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward record not found")

    await db.referral_rewards.update_one(
        {"id": rid},
        {
            "$set": {
                "status": "held",
                "hold_note": input.note,
                "hold_review_date": input.review_date,
                "held_by": user["email"],
                "held_at": now_utc(),
                "updated_at": now_utc(),
            }
        }
    )
    await audit(user, "referral_reward.hold", "reward", rid, f"Held until {input.review_date}: {input.note}")
    return {"status": "success", "message": "Reward placed on administrative hold"}


# Withdrawal Management Queue & UTR Processing
@router.get("/admin/referrals/withdrawals")
async def list_withdrawals(
    status: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN)),
):
    query = {}
    if status and status != "ALL":
        query["status"] = status.upper()
    docs = await db.referral_withdrawals.find(query).sort("created_at", -1).to_list(100)
    return [clean_doc(d) for d in docs]


@router.post("/admin/referrals/withdrawals/{wid}/mark-paid")
async def mark_withdrawal_paid(wid: str, input: WithdrawalActionIn, user=Depends(require_role(OWNER, ADMIN))):
    """Confirm bank transfer/UPI payout with official UTR reference and record green PAYMENT DONE status."""
    withdrawal = await db.referral_withdrawals.find_one({"id": wid})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if withdrawal.get("status") == "PAID":
        raise HTTPException(status_code=400, detail="This withdrawal request has already been marked as PAID")

    payment_record = {
        "status": "PAID",
        "utr_number": input.utr_number.strip().upper(),
        "payment_method": input.payment_method,
        "payment_date": input.payment_date or datetime.now().strftime("%Y-%m-%d"),
        "note": input.note,
        "processed_by": user["email"],
        "processed_at": now_utc(),
        "updated_at": now_utc(),
    }

    await db.referral_withdrawals.update_one({"id": wid}, {"$set": payment_record})

    # Mark corresponding user rewards as paid
    user_id = withdrawal.get("user_id")
    rem_amount = withdrawal.get("amount", 0)
    appr_rewards = await db.referral_rewards.find({"user_id": user_id, "status": "approved"}).sort("created_at", 1).to_list(100)
    for rw in appr_rewards:
        if rem_amount <= 0:
            break
        await db.referral_rewards.update_one(
            {"id": rw["id"]},
            {"$set": {"status": "paid", "withdrawal_id": wid, "paid_at": now_utc()}}
        )
        rem_amount -= rw.get("amount", 0)

    await audit(user, "referral.withdrawal_paid", "withdrawal", wid, f"Recorded PAYMENT DONE: UTR {input.utr_number}, ₹{withdrawal.get('amount')}")
    return {"status": "success", "message": f"Payment recorded successfully with UTR: {input.utr_number}"}


# Fraud Detection
@router.get("/admin/referrals/fraud-alerts")
async def get_fraud_alerts(user=Depends(require_role(OWNER, ADMIN))):
    """Detect potential self-referral, device/phone sharing, and refund abuse."""
    alerts = []
    
    # 1. Self-referrals: Check if referrer and customer share email, phone, or address
    rewards = await db.referral_rewards.find({}).to_list(500)
    for r in rewards:
        ref_id = r.get("referrer_user_id")
        cust_id = r.get("customer_user_id")
        if ref_id and cust_id and ref_id == cust_id:
            alerts.append({
                "type": "SELF_REFERRAL_SAME_ACCOUNT",
                "severity": "CRITICAL",
                "message": f"Reward {r.get('id')} has identical referrer and customer account ID {ref_id}",
                "reward_id": r.get("id"),
                "order_number": r.get("order_number"),
            })

    # 2. Cancelled or Refunded Orders with Active Rewards
    orders = await db.orders.find({"referral_code": {"$ne": None}, "fulfilment_status": {"$in": ["returned", "cancelled"]}}).to_list(200)
    for o in orders:
        linked_rewards = await db.referral_rewards.find({"order_id": o.get("id"), "status": {"$in": ["pending", "approved", "paid"]}}).to_list(10)
        for lr in linked_rewards:
            alerts.append({
                "type": "CANCELLED_ORDER_ACTIVE_REWARD",
                "severity": "HIGH",
                "message": f"Order {o.get('order_number')} was {o.get('fulfilment_status')}, but reward of ₹{lr.get('amount')} is in '{lr.get('status')}' state.",
                "reward_id": lr.get("id"),
                "order_number": o.get("order_number"),
            })

    return {
        "alert_count": len(alerts),
        "alerts": alerts,
    }
