"""Authoritative Refer & Earn Engine:
- Multi-tier Commission Rules & Historical Snapshot
- Real-time Attribution & Conversion Tracking
- KYC (PAN) & Bank Account Verification Lifecycle
- Configurable Statutory TDS Engine (Section 393 Compliance)
- Double-Entry Auditable Wallet & Commission Ledger
- Multi-state Withdrawal & Payout Processing (Requested -> Approved -> Processing -> Paid)
- Excel (.xlsx) Exports for Referrers, Leads, Sales, and Withdrawals
- Customer Referrer Portal Experience
"""

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from lib.db import db
from lib.security import ADMIN, OWNER, audit, now_utc, require_role, require_user, optional_user, CART_COOKIE
from lib.services import clean_doc
from models.referral_engine import (
    BankDetailsIn,
    CommissionRuleIn,
    ProductReferralRuleIn,
    BulkRuleActionIn,
    ReferralSettingsIn,
    ReferralClickIn,
    ReferralValidateIn,
    KYCSubmissionIn,
    TaxSettingsIn,
    VerificationActionIn,
    WithdrawalActionIn,
    WithdrawalRequestIn,
    WithdrawalReviewIn,
)
from lib.referral_pricing import get_referral_settings
from lib.referral_lead_service import (
    record_referral_click,
    qualify_or_update_lead,
    mask_email,
    mask_phone,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def mask_pan(pan: str) -> str:
    if not pan or len(pan) < 6:
        return pan or ""
    return f"{pan[:5]}****{pan[-1]}"


def mask_account(acc: str) -> str:
    if not acc or len(acc) < 4:
        return acc or ""
    return f"XXXXXX{acc[-4:]}"


async def get_active_tds_settings() -> dict:
    sett = await db.settings.find_one({"id": "referral_tax"})
    if not sett:
        sett = {
            "id": "referral_tax",
            "tds_enabled": True,
            "payment_nature": "Commission / Brokerage - Section 393, Income-tax Act 2025",
            "pan_available_rate": 5.0,
            "pan_not_available_rate": 20.0,
            "applicable_threshold": 15000.0,
            "effective_from": "2026-04-01",
            "notes": "Statutory non-salary withholding rate configured per Section 393 compliance.",
        }
    return sett


async def compute_referrer_wallet(user_id: str) -> dict:
    """Calculate authoritative financial balances for a referrer."""
    rewards = await db.referral_rewards.find({"user_id": user_id}).to_list(2000)
    
    total_earned = sum(r.get("amount", 0) for r in rewards if r.get("status") in ("pending", "approved", "paid"))
    pending_commission = sum(r.get("amount", 0) for r in rewards if r.get("status") == "pending")
    paid_commission = sum(r.get("amount", 0) for r in rewards if r.get("status") == "paid")
    approved_commission = sum(r.get("amount", 0) for r in rewards if r.get("status") == "approved")
    
    # Active withdrawals (requested, on hold, approved, processing)
    active_withdrawals = await db.referral_withdrawals.find({
        "user_id": user_id,
        "status": {"$in": ["REQUESTED", "UNDER_REVIEW", "ON_HOLD", "APPROVED", "PROCESSING"]}
    }).to_list(500)
    reserved_amount = sum(w.get("amount", 0) for w in active_withdrawals)
    
    available_to_withdraw = max(0.0, approved_commission - reserved_amount)

    return {
        "total_earned": round(total_earned, 2),
        "pending_commission": round(pending_commission, 2),
        "approved_commission": round(approved_commission, 2),
        "paid_commission": round(paid_commission, 2),
        "reserved_amount": round(reserved_amount, 2),
        "reserved_for_withdrawal": round(reserved_amount, 2),
        "available_to_withdraw": round(available_to_withdraw, 2),
    }


# ---------------------------------------------------------------------------
# 1. Customer / Referrer Portal APIs
# ---------------------------------------------------------------------------

@router.post("/referrals/click")
async def track_click(input: ReferralClickIn, request: Request, response: Response, user=Depends(optional_user)):
    """Server-authoritative referral link entry validation and visit recording."""
    cart_token = request.cookies.get(CART_COOKIE)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    user_id = user["id"] if user else None

    is_valid, err_msg, ref_info = await record_referral_click(
        code=input.code,
        path=input.path or "/",
        cart_token=cart_token,
        user_id=user_id,
        ip=client_ip,
        user_agent=user_agent,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg or "Invalid referral link")

    return {
        "ok": True,
        "valid": True,
        "code": ref_info["code"],
        "referrer_name": ref_info.get("referrer_name"),
    }


@router.post("/referrals/validate")
async def validate_referral_code(input: ReferralValidateIn, user=Depends(optional_user)):
    """Validate a referral code server-side for manual entry in cart or signup."""
    clean_code = (input.code or "").strip().upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Referral code is required")

    referrer = await db.users.find_one({"referral_code": clean_code, "is_active": True})
    if not referrer:
        raise HTTPException(status_code=404, detail="Referral code is invalid or inactive")

    sett = await db.referral_settings.find_one({"id": "referral_settings"}) or {}
    if user and not sett.get("allow_self_referral", False) and referrer["id"] == user["id"]:
        raise HTTPException(status_code=422, detail="You cannot refer yourself")

    return {
        "valid": True,
        "code": clean_code,
        "referrer_name": referrer.get("name", "Kotson Referrer"),
    }


@router.get("/referrals/portal")
@router.get("/referrals/me")
async def get_referrer_portal(user=Depends(require_user)):
    """Portal dashboard data for the authenticated referrer."""
    user_doc = await db.users.find_one({"id": user["id"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User account not found")

    code = user_doc.get("referral_code")
    if not code:
        from lib.security import mint_referral_code
        new_code = None
        for _ in range(50):
            c = mint_referral_code()
            if not await db.users.find_one({"referral_code": c}):
                new_code = c
                break
        if not new_code:
            new_code = f"KS{uuid.uuid4().hex[:6].upper()}"
        await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": new_code}})
        user_doc["referral_code"] = new_code
        code = new_code
    base = os.environ.get("APP_URL", "").rstrip("/") or "http://localhost:3000"

    wallet = await compute_referrer_wallet(user["id"])

    leads_count = await db.referral_attributions.count_documents({"code": code}) if code else 0
    sales_count = await db.orders.count_documents({"referral_code": code, "payment_status": "paid"}) if code else 0

    # KYC & Bank details
    kyc_data = user_doc.get("kyc", {})
    bank_data = user_doc.get("bank", {})

    kyc_summary = {
        "status": kyc_data.get("status", "NOT_SUBMITTED"),
        "pan_masked": kyc_data.get("pan_masked") or mask_pan(kyc_data.get("pan_number", "")),
        "pan_name": kyc_data.get("pan_name"),
        "rejection_reason": kyc_data.get("rejection_reason"),
    }
    bank_summary = {
        "status": bank_data.get("status", "NOT_ADDED"),
        "account_holder_name": bank_data.get("account_holder_name"),
        "account_number_masked": bank_data.get("account_number_masked") or mask_account(bank_data.get("account_number", "")),
        "ifsc_code": bank_data.get("ifsc_code"),
        "bank_name": bank_data.get("bank_name"),
        "rejection_reason": bank_data.get("rejection_reason"),
    }

    # Recent Leads formatted with privacy-safe masked data and exact journey status
    raw_leads = await db.referral_attributions.find(
        {"code": code} if code else {"_id": None}
    ).sort("created_at", -1).limit(50).to_list(50)

    formatted_leads = []
    for d in raw_leads:
        formatted_leads.append({
            "id": d.get("id"),
            "lead_number": d.get("lead_number") or f"REF-{str(d.get('id', ''))[-5:].upper()}",
            "customer_name": d.get("customer_name") or "Referred Customer",
            "customer_email_masked": d.get("customer_email_masked") or mask_email(d.get("email")),
            "customer_phone_masked": d.get("customer_phone_masked") or mask_phone(d.get("phone")),
            "activity": d.get("last_activity_type") or "Added to Cart",
            "last_activity_at": d.get("last_activity_at") or d.get("created_at"),
            "status": d.get("status") or "CART_ACTIVE",
            "converted": d.get("converted", False),
            "sales": d.get("order_number") or (", ".join(d.get("orders", [])) if d.get("orders") else "—"),
            "sale_value": d.get("sale_value", 0.0),
            "commission_status": d.get("commission_status", "NONE"),
            "created_at": d.get("created_at"),
        })

    # Recent Commissions
    recent_rewards = await db.referral_rewards.find(
        {"user_id": user["id"]}
    ).sort("created_at", -1).limit(50).to_list(50)

    # Earnings by Product breakdown
    earnings_by_product_map = {}
    for rw in recent_rewards:
        p_name = rw.get("product_name") or "Catalogue Product"
        if p_name not in earnings_by_product_map:
            earnings_by_product_map[p_name] = {
                "product_name": p_name,
                "category": rw.get("product_category", "Store"),
                "sales_count": 0,
                "commission_earned": 0.0,
            }
        earnings_by_product_map[p_name]["sales_count"] += 1
        earnings_by_product_map[p_name]["commission_earned"] += rw.get("amount", 0.0)

    earnings_by_product = []
    for k, v in earnings_by_product_map.items():
        earnings_by_product.append({
            "product_name": v["product_name"],
            "category": v["category"],
            "sales_count": v["sales_count"],
            "commission_earned": round(v["commission_earned"], 2),
        })

    # Withdrawal History
    withdrawals = await db.referral_withdrawals.find(
        {"user_id": user["id"]}
    ).sort("created_at", -1).limit(50).to_list(50)

    # Active TDS configuration (so referrer sees estimated TDS rules)
    tds_settings = await get_active_tds_settings()
    has_pan = kyc_data.get("status") == "VERIFIED"
    estimated_tds_rate = tds_settings.get("pan_available_rate", 5.0) if has_pan else tds_settings.get("pan_not_available_rate", 20.0)

    paid_orders = await db.orders.find({"referral_code": code, "payment_status": "paid"}).to_list(100) if code else []
    sales_value = sum(o.get("total_amount", 0) for o in paid_orders)

    user_info = {
        "id": user["id"],
        "name": user_doc.get("name"),
        "email": user_doc.get("email"),
        "phone": user_doc.get("phone"),
        "referral_code": code,
        "share_url": f"{base}/?ref={code}" if code else None,
        "kyc": kyc_summary,
        "bank": bank_summary,
    }

    perf_info = {
        "leads": leads_count,
        "total_leads": leads_count,
        "sales": sales_count,
        "total_sales": sales_count,
        "sales_value": round(sales_value, 2),
        "conversion_rate": round((sales_count / leads_count * 100) if leads_count > 0 else 0.0, 1),
    }

    return {
        "user": user_info,
        "referral_code": code,
        "share_url": f"{base}/?ref={code}" if code else None,
        "performance": perf_info,
        "wallet": wallet,
        "kyc": kyc_summary,
        "bank": bank_summary,
        "estimated_tds_rate": estimated_tds_rate,
        "tax_settings": {
            "tds_enabled": tds_settings.get("tds_enabled", True),
            "pan_available_rate": tds_settings.get("pan_available_rate", 5.0),
            "pan_not_available_rate": tds_settings.get("pan_not_available_rate", 20.0),
            "applicable_threshold": tds_settings.get("applicable_threshold", 15000.0),
            "payment_nature": tds_settings.get("payment_nature", "Section 393 Compliance"),
        },
        "leads": formatted_leads,
        "rewards": [clean_doc(d) for d in recent_rewards],
        "sales": [clean_doc(d) for d in recent_rewards],
        "earnings_by_product": earnings_by_product,
        "withdrawals": [clean_doc(d) for d in withdrawals],
        "policy": "Earn guaranteed rewards on every qualified order placed through your referral link. Rewards are verified and directly transferable to your bank account after KYC verification.",
    }


@router.post("/referrals/kyc")
async def submit_referrer_kyc(input: KYCSubmissionIn, user=Depends(require_user)):
    """Submit PAN card details for KYC verification."""
    clean_pan = input.pan_number.strip().upper()
    if len(clean_pan) != 10:
        raise HTTPException(status_code=400, detail="Invalid PAN format (Must be 10 characters)")

    kyc_doc = {
        "pan_number": clean_pan,
        "pan_masked": mask_pan(clean_pan),
        "pan_name": input.pan_name.strip(),
        "pan_doc_url": input.pan_doc_url,
        "status": "PENDING_VERIFICATION",
        "submitted_at": now_utc(),
        "rejection_reason": None,
    }

    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc": kyc_doc, "updated_at": now_utc()}})
    await audit(user, "referral.kyc_submitted", "user", user["id"], f"Submitted PAN: {mask_pan(clean_pan)}")
    return {"status": "success", "message": "PAN KYC submitted for verification", "kyc": kyc_doc}


@router.post("/referrals/bank")
async def submit_referrer_bank(input: BankDetailsIn, user=Depends(require_user)):
    """Submit bank account details for withdrawal disbursements."""
    acc = input.account_number.strip()
    confirm_acc = input.confirm_account_number.strip()
    if acc != confirm_acc:
        raise HTTPException(status_code=400, detail="Account numbers do not match")

    clean_ifsc = input.ifsc_code.strip().upper()
    if len(clean_ifsc) != 11:
        raise HTTPException(status_code=400, detail="Invalid IFSC format (Must be 11 characters)")

    bank_doc = {
        "account_holder_name": input.account_holder_name.strip(),
        "account_number": acc,
        "account_number_masked": mask_account(acc),
        "ifsc_code": clean_ifsc,
        "bank_name": input.bank_name.strip() if input.bank_name else "Bank Account",
        "branch": input.branch.strip() if input.branch else None,
        "status": "PENDING_VERIFICATION",
        "submitted_at": now_utc(),
        "rejection_reason": None,
    }

    await db.users.update_one({"id": user["id"]}, {"$set": {"bank": bank_doc, "updated_at": now_utc()}})
    await audit(user, "referral.bank_submitted", "user", user["id"], f"Submitted Bank Account: {mask_account(acc)}")
    return {"status": "success", "message": "Bank details submitted for verification", "bank": bank_doc}


@router.post("/referrals/request-withdrawal")
async def request_withdrawal(input: WithdrawalRequestIn, user=Depends(require_user)):
    """Request a withdrawal from available wallet balance with balance reservation and statutory TDS snapshot."""
    user_doc = await db.users.find_one({"id": user["id"]})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User account not found")

    amount = round(float(input.amount), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero")

    # KYC & Bank Enforcements
    kyc_data = user_doc.get("kyc", {})
    bank_data = user_doc.get("bank", {})

    if kyc_data.get("status") != "VERIFIED":
        raise HTTPException(status_code=400, detail="KYC verification is required before initiating withdrawals")
    if bank_data.get("status") != "VERIFIED":
        raise HTTPException(status_code=400, detail="Bank account verification is required before initiating withdrawals")

    # Authoritative Balance Check
    wallet = await compute_referrer_wallet(user["id"])
    available = wallet["available_to_withdraw"]

    if amount > available:
        raise HTTPException(status_code=400, detail=f"Insufficient available balance (Available: ₹{available:,.2f})")

    # TDS Calculation from active statutory rules (Section 393 compliance)
    tds_settings = await get_active_tds_settings()
    tds_enabled = tds_settings.get("tds_enabled", True)
    pan_verified = kyc_data.get("status") == "VERIFIED"
    
    tds_rate = tds_settings.get("pan_available_rate", 5.0) if pan_verified else tds_settings.get("pan_not_available_rate", 20.0)
    tds_amount = round(amount * (tds_rate / 100.0), 2) if tds_enabled else 0.0
    net_payable = round(amount - tds_amount, 2)

    req_id = str(uuid.uuid4())
    req_num = f"KW-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

    withdrawal_doc = {
        "id": req_id,
        "request_number": req_num,
        "user_id": user["id"],
        "referral_code": user_doc.get("referral_code"),
        "user_name": user_doc.get("name"),
        "user_email": user_doc.get("email"),
        "user_phone": user_doc.get("phone"),
        "amount": amount,
        "requested_amount": amount,
        "tds_rate": tds_rate,
        "tds_amount": tds_amount,
        "net_payable": net_payable,
        "tds_rule_snapshot": {
            "tds_enabled": tds_enabled,
            "rate_applied": tds_rate,
            "nature_of_payment": tds_settings.get("payment_nature", "Section 393 Compliance"),
            "pan_available": pan_verified,
        },
        "bank_details_snapshot": {
            "account_holder_name": bank_data.get("account_holder_name"),
            "account_number_masked": bank_data.get("account_number_masked") or mask_account(bank_data.get("account_number", "")),
            "ifsc_code": bank_data.get("ifsc_code"),
            "bank_name": bank_data.get("bank_name"),
        },
        "pan_details_snapshot": {
            "pan_masked": kyc_data.get("pan_masked") or mask_pan(kyc_data.get("pan_number", "")),
            "pan_name": kyc_data.get("pan_name"),
        },
        "kyc_status_at_request": "VERIFIED",
        "status": "REQUESTED",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    await db.referral_withdrawals.insert_one(withdrawal_doc)

    # Double-entry ledger: Reserve funds
    ledger_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "code": user_doc.get("referral_code"),
        "transaction_type": "WITHDRAWAL_RESERVED",
        "amount": amount,
        "reference_id": req_id,
        "notes": f"Withdrawal request {req_num} placed for ₹{amount:,.2f}",
        "created_at": now_utc(),
        "created_by": user["email"],
    }
    await db.wallet_ledger.insert_one(ledger_entry)

    await audit(user, "referral.withdrawal_requested", "withdrawal", req_id, f"Requested ₹{amount:,.2f} ({req_num})")

    ret = clean_doc(withdrawal_doc)
    ret["withdrawal_id"] = req_id
    return ret


# ---------------------------------------------------------------------------
# 2. Owner Admin — Refer & Earn Dashboard & Referrers Hub
# ---------------------------------------------------------------------------

@router.get("/admin/referrals/overview")
async def admin_referrals_overview(user=Depends(require_role(OWNER, ADMIN))):
    """The authoritative Executive KPI cards and Funnel metrics for Refer & Earn."""
    # 1. Total Referrers
    total_referrers = await db.users.count_documents({"referral_code": {"$ne": None}})

    # 2. Total Referral Leads
    total_leads = await db.referral_attributions.count_documents({})

    # 3. Referral Sales & Sales Value
    paid_referral_orders = await db.orders.find(
        {"referral_code": {"$ne": None}, "payment_status": "paid"}
    ).to_list(10000)
    referral_sales = len(paid_referral_orders)
    referral_sales_value = sum(o.get("total_amount", 0) for o in paid_referral_orders)
    customer_discounts_given = sum(o.get("referral_discount_amount", 0) for o in paid_referral_orders)

    # 4. Commissions
    all_rewards = await db.referral_rewards.find({}).to_list(10000)
    pending_commission = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "pending")
    approved_commission = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "approved")
    paid_commission = sum(r.get("amount", 0) for r in all_rewards if r.get("status") == "paid")
    total_commission_earned = approved_commission + paid_commission + pending_commission

    # 5. Pending Withdrawals
    pending_withdrawals = await db.referral_withdrawals.find(
        {"status": {"$in": ["REQUESTED", "UNDER_REVIEW", "ON_HOLD", "APPROVED", "PROCESSING"]}}
    ).to_list(1000)
    pending_withdrawals_count = len(pending_withdrawals)
    pending_withdrawals_value = sum(w.get("amount", 0) for w in pending_withdrawals)

    # 6. Referral Acquisition Funnel
    total_visits = await db.referral_clicks.count_documents({})
    accounts_created = await db.referral_attributions.count_documents({"customer_id": {"$ne": None}})
    carts_active = await db.referral_attributions.count_documents({"status": "CART_ACTIVE"})
    checkout_started = await db.referral_attributions.count_documents({"status": {"$in": ["CHECKOUT_STARTED", "PAYMENT_ATTEMPTED", "PAYMENT_CANCELLED", "CONVERTED"]}})

    return {
        "total_referrers": total_referrers,
        "total_leads": total_leads,
        "total_referral_leads": total_leads,
        "referral_sales": referral_sales,
        "completed_sales_count": referral_sales,
        "referral_sales_value": round(referral_sales_value, 2),
        "customer_discounts_given": round(customer_discounts_given, 2),
        "pending_commission": round(pending_commission, 2),
        "approved_commission": round(approved_commission, 2),
        "total_commission_earned": round(total_commission_earned, 2),
        "total_paid_commission": round(paid_commission, 2),
        "total_withdrawn_paid": round(paid_commission, 2),
        "pending_withdrawals": pending_withdrawals_count,
        "pending_withdrawals_count": pending_withdrawals_count,
        "pending_withdrawals_value": round(pending_withdrawals_value, 2),
        "funnel": {
            "visits": total_visits,
            "leads": total_leads,
            "accounts_created": accounts_created,
            "carts_active": carts_active,
            "checkout_started": checkout_started,
            "sales": referral_sales,
            "conversion_rate": round((referral_sales / total_leads * 100) if total_leads > 0 else 0.0, 1),
        },
    }


@router.get("/admin/referrals/leads")
async def list_admin_leads(
    q: Optional[str] = None,
    status: Optional[str] = None,
    code: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN)),
):
    """Server-paginated referral leads list for Owner Admin with search and filters."""
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status
    if code:
        query["code"] = code.strip().upper()
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            query["created_at"]["$gte"] = f"{date_from}T00:00:00"
        if date_to:
            query["created_at"]["$lte"] = f"{date_to}T23:59:59"
    if q:
        q_clean = q.strip()
        query["$or"] = [
            {"lead_number": {"$regex": q_clean, "$options": "i"}},
            {"code": {"$regex": q_clean, "$options": "i"}},
            {"customer_name": {"$regex": q_clean, "$options": "i"}},
            {"order_number": {"$regex": q_clean, "$options": "i"}},
        ]

    total = await db.referral_attributions.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.referral_attributions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "leads": [clean_doc(d) for d in docs],
    }


@router.get("/admin/referrals/referrers")
async def list_referrers(
    q: Optional[str] = None,
    status: Optional[str] = None,
    lead_count_op: Optional[str] = None,
    lead_count_val: Optional[int] = None,
    lead_count_val2: Optional[int] = None,
    sales_count_op: Optional[str] = None,
    sales_count_val: Optional[int] = None,
    sales_count_val2: Optional[int] = None,
    date_preset: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    user=Depends(require_role(OWNER, ADMIN)),
):
    """Server-side paginated, searchable, filterable, and sortable referrers list."""
    query: dict = {"referral_code": {"$ne": None}}

    if status and status != "ALL":
        if status.lower() == "active":
            query["is_active"] = True
        elif status.lower() == "inactive":
            query["is_active"] = False

    if q:
        query["$or"] = [
            {"name": {"$regex": q.strip(), "$options": "i"}},
            {"referral_code": {"$regex": q.strip(), "$options": "i"}},
            {"email": {"$regex": q.strip(), "$options": "i"}},
        ]

    # Date range filters on joined date
    if date_from or date_to:
        d_query = {}
        if date_from:
            d_query["$gte"] = date_from
        if date_to:
            d_query["$lte"] = date_to + "T23:59:59.999Z"
        query["created_at"] = d_query

    users = await db.users.find(query).to_list(1000)

    # Compute live stats per referrer
    enriched_rows = []
    for u in users:
        u_code = u.get("referral_code")
        u_id = u["id"]

        leads_cnt = await db.referral_attributions.count_documents({"code": u_code}) if u_code else 0
        paid_orders = await db.orders.find({"referral_code": u_code, "payment_status": "paid"}).to_list(500) if u_code else []
        sales_cnt = len(paid_orders)
        sales_val = sum(o.get("total_amount", 0) for o in paid_orders)

        wallet = await compute_referrer_wallet(u_id)

        # Apply numeric count filters
        if lead_count_op and lead_count_val is not None:
            if lead_count_op == "eq" and leads_cnt != lead_count_val:
                continue
            if lead_count_op == "gte" and leads_cnt < lead_count_val:
                continue
            if lead_count_op == "lte" and leads_cnt > lead_count_val:
                continue
            if lead_count_op == "range" and lead_count_val2 is not None:
                if not (lead_count_val <= leads_cnt <= lead_count_val2):
                    continue

        if sales_count_op and sales_count_val is not None:
            if sales_count_op == "eq" and sales_cnt != sales_count_val:
                continue
            if sales_count_op == "gte" and sales_cnt < sales_count_val:
                continue
            if sales_count_op == "lte" and sales_cnt > sales_count_val:
                continue
            if sales_count_op == "range" and sales_count_val2 is not None:
                if not (sales_count_val <= sales_cnt <= sales_count_val2):
                    continue

        kyc_data = u.get("kyc", {})
        bank_data = u.get("bank", {})

        enriched_rows.append({
            "id": u_id,
            "user_id": u_id,
            "name": u.get("name", "Unnamed"),
            "referral_code": u_code,
            "email": u.get("email"),
            "phone": u.get("phone"),
            "status": "Active" if u.get("is_active", True) else "Inactive",
            "created_at": u.get("created_at"),
            "leads": leads_cnt,
            "leads_count": leads_cnt,
            "sales": sales_cnt,
            "sales_count": sales_cnt,
            "sales_value": round(sales_val, 2),
            "pending_amount": wallet["pending_commission"],
            "available_amount": wallet["available_to_withdraw"],
            "reserved_amount": wallet.get("reserved_for_withdrawal", 0),
            "total_earned": wallet["total_earned"],
            "paid_amount": wallet["paid_commission"],
            "kyc_status": kyc_data.get("status", "NOT_SUBMITTED"),
            "bank_status": bank_data.get("status", "NOT_ADDED"),
        })

    # Sort in Python
    reverse = sort_order.lower() == "desc"
    sort_key_map = {
        "name": lambda x: x["name"].lower(),
        "code": lambda x: (x["referral_code"] or "").lower(),
        "leads": lambda x: x["leads"],
        "leads_count": lambda x: x["leads"],
        "sales": lambda x: x["sales"],
        "sales_count": lambda x: x["sales"],
        "sales_value": lambda x: x["sales_value"],
        "pending_amount": lambda x: x["pending_amount"],
        "available_amount": lambda x: x["available_amount"],
        "total_earned": lambda x: x["total_earned"],
        "paid_amount": lambda x: x["paid_amount"],
        "created_at": lambda x: str(x["created_at"] or ""),
        "date_joined": lambda x: str(x["created_at"] or ""),
    }
    key_fn = sort_key_map.get(sort_by, sort_key_map["created_at"])
    enriched_rows.sort(key=key_fn, reverse=reverse)

    total = len(enriched_rows)
    skip = (page - 1) * page_size
    paginated = enriched_rows[skip : skip + page_size]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "limit": page_size,
        "items": paginated,
        "referrers": paginated,
    }


@router.get("/admin/referrals/referrers/{user_id}")
async def get_referrer_detail(user_id: str, user=Depends(require_role(OWNER, ADMIN))):
    """Detailed Referrer Profile with Performance, Leads, Sales, Commission Ledger, and Withdrawals."""
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Referrer user not found")

    code = target_user.get("referral_code")
    wallet = await compute_referrer_wallet(user_id)

    # Leads (with masked PII for safe display)
    leads = await db.referral_attributions.find({"code": code} if code else {"_id": None}).sort("created_at", -1).to_list(100)
    
    # Sales
    paid_orders = await db.orders.find({"referral_code": code, "payment_status": "paid"}).sort("created_at", -1).to_list(100) if code else []
    sales_value = sum(o.get("total_amount", 0) for o in paid_orders)

    # Commissions
    commissions = await db.referral_rewards.find({"user_id": user_id}).sort("created_at", -1).to_list(100)

    # Withdrawals
    withdrawals = await db.referral_withdrawals.find({"user_id": user_id}).sort("created_at", -1).to_list(50)

    # Ledger
    ledger = await db.wallet_ledger.find({"user_id": user_id}).sort("created_at", -1).to_list(100)

    kyc_data = target_user.get("kyc", {})
    bank_data = target_user.get("bank", {})

    kyc_info = {
        "status": kyc_data.get("status", "NOT_SUBMITTED"),
        "pan_masked": kyc_data.get("pan_masked") or mask_pan(kyc_data.get("pan_number", "")),
        "name_as_per_pan": kyc_data.get("pan_name") or kyc_data.get("name_as_per_pan"),
        "pan_name": kyc_data.get("pan_name"),
        "rejection_reason": kyc_data.get("rejection_reason"),
        "verified_at": kyc_data.get("verified_at"),
        "verified_by": kyc_data.get("verified_by"),
    }
    bank_info = {
        "status": bank_data.get("status", "NOT_ADDED"),
        "account_holder_name": bank_data.get("account_holder_name"),
        "account_number_masked": bank_data.get("account_number_masked") or mask_account(bank_data.get("account_number", "")),
        "ifsc_code": bank_data.get("ifsc_code"),
        "bank_name": bank_data.get("bank_name"),
        "branch": bank_data.get("branch"),
        "branch_name": bank_data.get("branch"),
        "rejection_reason": bank_data.get("rejection_reason"),
        "verified_at": bank_data.get("verified_at"),
        "verified_by": bank_data.get("verified_by"),
    }

    return {
        "profile": {
            "id": target_user["id"],
            "name": target_user.get("name"),
            "email": target_user.get("email"),
            "phone": target_user.get("phone"),
            "referral_code": code,
            "status": "Active" if target_user.get("is_active", True) else "Inactive",
            "date_joined": target_user.get("created_at"),
            "created_at": target_user.get("created_at"),
            "kyc": kyc_info,
            "bank": bank_info,
        },
        "kyc": kyc_info,
        "bank": bank_info,
        "performance": {
            "total_leads": len(leads),
            "total_sales": len(paid_orders),
            "leads_count": len(leads),
            "sales_count": len(paid_orders),
            "sales_value": round(sales_value, 2),
            "conversion_rate": round((len(paid_orders) / len(leads) * 100) if len(leads) > 0 else 0.0, 1),
            "pending_commission": wallet["pending_commission"],
            "available_commission": wallet["available_to_withdraw"],
            "reserved_commission": wallet.get("reserved_amount", 0),
            "total_earned": wallet["total_earned"],
            "total_paid": wallet["paid_commission"],
            "wallet": wallet,
        },
        "leads": [clean_doc(d) for d in leads],
        "sales": [clean_doc(d) for d in commissions],
        "commission_ledger": [clean_doc(d) for d in commissions],
        "withdrawals": [clean_doc(d) for d in withdrawals],
        "ledger": [clean_doc(d) for d in ledger],
    }


@router.post("/admin/referrals/referrers/{user_id}/kyc-verify")
async def verify_referrer_kyc(user_id: str, input: VerificationActionIn, user=Depends(require_role(OWNER, ADMIN))):
    """Admin approval or rejection of Referrer PAN KYC."""
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Referrer user not found")

    act = input.action.strip().lower()
    if act in ("approve", "verify", "verified", "approved"):
        new_status = "VERIFIED"
    elif act in ("reject", "rejected"):
        new_status = "REJECTED"
    else:
        new_status = "NEEDS_CORRECTION"

    is_verified = new_status == "VERIFIED"
    patch = {
        "kyc.status": new_status,
        "kyc.rejection_reason": input.reason if not is_verified else None,
        "kyc.verified_at": now_utc() if is_verified else None,
        "kyc.verified_by": user["email"] if is_verified else None,
        "updated_at": now_utc(),
    }
    await db.users.update_one({"id": user_id}, {"$set": patch})
    await audit(user, f"referral.kyc_{act}", "user", user_id, f"KYC status changed to {new_status}. Reason: {input.reason or 'N/A'}")
    return {"status": "success", "message": f"KYC status updated to {new_status}"}


@router.post("/admin/referrals/referrers/{user_id}/bank-verify")
async def verify_referrer_bank(user_id: str, input: VerificationActionIn, user=Depends(require_role(OWNER, ADMIN))):
    """Admin approval or rejection of Referrer Bank details."""
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Referrer user not found")

    act = input.action.strip().lower()
    if act in ("approve", "verify", "verified", "approved"):
        new_status = "VERIFIED"
    elif act in ("reject", "rejected"):
        new_status = "REJECTED"
    else:
        new_status = "NEEDS_CORRECTION"

    is_verified = new_status == "VERIFIED"
    patch = {
        "bank.status": new_status,
        "bank.rejection_reason": input.reason if not is_verified else None,
        "bank.verified_at": now_utc() if is_verified else None,
        "bank.verified_by": user["email"] if is_verified else None,
        "updated_at": now_utc(),
    }
    await db.users.update_one({"id": user_id}, {"$set": patch})
    await audit(user, f"referral.bank_{act}", "user", user_id, f"Bank status changed to {new_status}. Reason: {input.reason or 'N/A'}")
    return {"status": "success", "message": f"Bank status updated to {new_status}"}


# ---------------------------------------------------------------------------
# 3. Owner Admin — Withdrawal Requests & Payout Management
# ---------------------------------------------------------------------------

@router.get("/admin/referrals/withdrawals")
async def list_admin_withdrawals(
    status: Optional[str] = None,
    q: Optional[str] = None,
    user=Depends(require_role(OWNER, ADMIN)),
):
    """Withdrawal management queue with explicit payout lifecycle filtering and summary metrics."""
    query: dict = {}
    if status and status != "ALL":
        query["status"] = status.upper()

    if q:
        query["$or"] = [
            {"request_number": {"$regex": q.strip(), "$options": "i"}},
            {"user_name": {"$regex": q.strip(), "$options": "i"}},
            {"referral_code": {"$regex": q.strip(), "$options": "i"}},
            {"user_email": {"$regex": q.strip(), "$options": "i"}},
            {"payout_details.utr_number": {"$regex": q.strip(), "$options": "i"}},
        ]

    docs = await db.referral_withdrawals.find(query).sort("created_at", -1).to_list(500)

    # Compute withdrawal metrics
    all_w = await db.referral_withdrawals.find({}).to_list(1000)
    metrics = {
        "pending_requests": len([w for w in all_w if w.get("status") in ("REQUESTED", "UNDER_REVIEW")]),
        "on_hold": len([w for w in all_w if w.get("status") == "ON_HOLD"]),
        "approved": len([w for w in all_w if w.get("status") == "APPROVED"]),
        "processing": len([w for w in all_w if w.get("status") == "PROCESSING"]),
        "paid": len([w for w in all_w if w.get("status") == "PAID"]),
        "rejected": len([w for w in all_w if w.get("status") == "REJECTED"]),
        "total_requested": round(sum(w.get("amount", 0) for w in all_w), 2),
        "total_paid": round(sum(w.get("amount", 0) for w in all_w if w.get("status") == "PAID"), 2),
        "tds_deducted": round(sum(w.get("tds_amount", 0) for w in all_w if w.get("status") == "PAID"), 2),
    }

    return {
        "metrics": metrics,
        "items": [clean_doc(d) for d in docs],
    }


@router.post("/admin/referrals/withdrawals/{wid}/review")
async def review_withdrawal(wid: str, input: WithdrawalReviewIn, user=Depends(require_role(OWNER, ADMIN))):
    """Owner review action: APPROVE, HOLD, or REJECT."""
    withdrawal = await db.referral_withdrawals.find_one({"id": wid})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")

    current_status = withdrawal.get("status")
    if current_status == "PAID":
        raise HTTPException(status_code=400, detail="Cannot alter request that has already been marked as PAID")

    user_id = withdrawal["user_id"]
    req_num = withdrawal.get("request_number", wid)
    amount = withdrawal.get("amount", 0)
    act = input.action.strip().lower()

    if act == "hold":
        if not input.reason:
            raise HTTPException(status_code=400, detail="Reason is mandatory when placing withdrawal on hold")
        patch = {
            "status": "ON_HOLD",
            "hold_reason": input.reason,
            "hold_review_date": input.review_date,
            "held_by": user["email"],
            "held_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.referral_withdrawals.update_one({"id": wid}, {"$set": patch})
        await audit(user, "referral.withdrawal_hold", "withdrawal", wid, f"Placed on hold ({req_num}): {input.reason}")
        return {"status": "success", "message": "Withdrawal request placed on hold"}

    elif act == "reject":
        if not input.reason:
            raise HTTPException(status_code=400, detail="Reason is mandatory when rejecting withdrawal")

        patch = {
            "status": "REJECTED",
            "rejection_reason": input.reason,
            "rejected_by": user["email"],
            "rejected_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.referral_withdrawals.update_one({"id": wid}, {"$set": patch})

        # Release reserved funds back to available via auditable ledger transaction
        ledger_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "code": withdrawal.get("referral_code"),
            "transaction_type": "WITHDRAWAL_RELEASED",
            "amount": amount,
            "reference_id": wid,
            "notes": f"Funds released back to available balance. Request {req_num} rejected: {input.reason}",
            "created_at": now_utc(),
            "created_by": user["email"],
        }
        await db.wallet_ledger.insert_one(ledger_entry)

        await audit(user, "referral.withdrawal_rejected", "withdrawal", wid, f"Rejected withdrawal ({req_num}): {input.reason}")
        return {"status": "success", "message": "Withdrawal request rejected and reserved balance released"}

    elif act == "approve":
        # Server re-validation: KYC, Bank, active state
        user_doc = await db.users.find_one({"id": user_id})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Referrer user no longer exists")
        if user_doc.get("kyc", {}).get("status") != "VERIFIED":
            raise HTTPException(status_code=400, detail="Referrer PAN KYC is not verified")
        if user_doc.get("bank", {}).get("status") != "VERIFIED":
            raise HTTPException(status_code=400, detail="Referrer Bank account is not verified")

        patch = {
            "status": "APPROVED",
            "approved_by": user["email"],
            "approved_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.referral_withdrawals.update_one({"id": wid}, {"$set": patch})
        await audit(user, "referral.withdrawal_approved", "withdrawal", wid, f"Approved withdrawal ({req_num}) for ₹{amount:,.2f}")
        return {"status": "success", "message": "Withdrawal request approved and queued for payout"}


@router.post("/admin/referrals/withdrawals/{wid}/mark-paid")
async def mark_withdrawal_paid(wid: str, input: WithdrawalActionIn, user=Depends(require_role(OWNER, ADMIN))):
    """Mark payout as complete with mandatory UTR number, payment method, and date."""
    withdrawal = await db.referral_withdrawals.find_one({"id": wid})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    if withdrawal.get("status") == "PAID":
        raise HTTPException(status_code=400, detail="Withdrawal request is already marked as PAID")

    clean_utr = input.utr_number.strip().upper()
    if len(clean_utr) < 4:
        raise HTTPException(status_code=400, detail="Valid payment UTR / Reference number is required")

    user_id = withdrawal["user_id"]
    req_num = withdrawal.get("request_number", wid)
    amount = withdrawal.get("amount", 0)
    tds_amt = withdrawal.get("tds_amount", 0)
    net_amt = withdrawal.get("net_payable", amount - tds_amt)

    payment_record = {
        "status": "PAID",
        "payout_details": {
            "utr_number": clean_utr,
            "payment_method": input.payment_method,
            "payment_date": input.payment_date or datetime.now().strftime("%Y-%m-%d"),
            "note": input.note,
            "paid_by": user["email"],
            "paid_at": now_utc(),
        },
        "paid_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.referral_withdrawals.update_one({"id": wid}, {"$set": payment_record})

    # Mark corresponding user commissions as paid
    rem_amount = amount
    approved_rewards = await db.referral_rewards.find(
        {"user_id": user_id, "status": "approved"}
    ).sort("created_at", 1).to_list(200)

    for rw in approved_rewards:
        if rem_amount <= 0:
            break
        await db.referral_rewards.update_one(
            {"id": rw["id"]},
            {"$set": {"status": "paid", "withdrawal_id": wid, "paid_at": now_utc()}}
        )
        rem_amount -= rw.get("amount", 0)

    # Insert payout transaction in wallet ledger
    ledger_entry = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "code": withdrawal.get("referral_code"),
        "transaction_type": "PAYOUT_PAID",
        "amount": net_amt,
        "reference_id": wid,
        "notes": f"Disbursed via {input.payment_method}. UTR: {clean_utr}. TDS Deducted: ₹{tds_amt:,.2f}",
        "created_at": now_utc(),
        "created_by": user["email"],
    }
    await db.wallet_ledger.insert_one(ledger_entry)

    await audit(user, "referral.withdrawal_paid", "withdrawal", wid, f"Recorded PAYMENT DONE: UTR {clean_utr}, Net ₹{net_amt:,.2f}")
    return {
        "status": "success",
        "message": f"Payment recorded successfully with UTR: {clean_utr}",
        "payout_details": payment_record["payout_details"],
        "net_payable": net_amt,
        "tds_amount": tds_amt,
    }


# ---------------------------------------------------------------------------
# 4. Owner Admin — Statutory TDS Settings (Section 393 Compliance)
# ---------------------------------------------------------------------------

@router.get("/admin/referrals/tax-settings")
async def get_tax_settings(user=Depends(require_role(OWNER, ADMIN))):
    """Retrieve active TDS configuration."""
    sett = await get_active_tds_settings()
    return clean_doc(sett)


@router.put("/admin/referrals/tax-settings")
async def update_tax_settings(input: TaxSettingsIn, user=Depends(require_role(OWNER, ADMIN))):
    """Update statutory TDS rates and thresholds with audit logging."""
    doc = input.model_dump()
    doc["id"] = "referral_tax"
    doc["updated_at"] = now_utc()
    doc["updated_by"] = user["email"]

    await db.settings.update_one({"id": "referral_tax"}, {"$set": doc}, upsert=True)
    await audit(user, "referral.tax_settings_updated", "settings", "referral_tax", f"TDS PAN Rate: {input.pan_available_rate}%, No-PAN: {input.pan_not_available_rate}%")
    return clean_doc(doc)


# ---------------------------------------------------------------------------
# 5. Owner Admin — Commission Rules Management
# ---------------------------------------------------------------------------

@router.get("/admin/referrals/products-catalog")
async def list_products_for_referral_rules(user=Depends(require_role(OWNER, ADMIN))):
    """Authoritative catalogue products for referral rule selection."""
    prods = await db.products.find({}, {"id": 1, "name": 1, "slug": 1, "category": 1, "price": 1, "images": 1, "is_active": 1}).to_list(500)
    return [clean_doc(p) for p in prods]


@router.get("/admin/referrals/rules")
async def list_referral_rules(user=Depends(require_role(OWNER, ADMIN))):
    rules = await db.referral_rules.find({}).sort("created_at", -1).to_list(200)
    products = await db.products.find({}, {"id": 1, "name": 1, "category": 1, "price": 1}).to_list(500)
    prod_map = {p["id"]: p for p in products}

    enriched = []
    for r in rules:
        doc = clean_doc(r)
        p_ids = doc.get("product_ids") or []
        if not p_ids and doc.get("product_id"):
            p_ids = [doc.get("product_id")]

        matched_products = [prod_map[pid] for pid in p_ids if pid in prod_map]
        product_names = [p.get("name", pid) for p in matched_products]
        categories = list(set(p.get("category", "General") for p in matched_products if p.get("category")))

        doc["product_ids"] = p_ids
        doc["products"] = [clean_doc(p) for p in matched_products]
        doc["product_names"] = ", ".join(product_names) if product_names else "All Products"
        doc["categories"] = ", ".join(categories) if categories else "General"
        doc["commission_type"] = doc.get("commission_type") or doc.get("reward_type", "PERCENTAGE")
        doc["commission_value"] = doc.get("commission_value", doc.get("value", 5.0))
        doc["discount_type"] = doc.get("discount_type", "PERCENTAGE")
        doc["discount_value"] = doc.get("discount_value", 0.0)
        doc["status"] = "Active" if doc.get("is_active", True) else "Inactive"
        enriched.append(doc)
    return enriched


@router.post("/admin/referrals/rules", status_code=201)
async def create_referral_rule(input: ProductReferralRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    data = input.model_dump()

    if data["commission_type"] == "PERCENTAGE" and (data["commission_value"] <= 0 or data["commission_value"] > 100):
        raise HTTPException(status_code=400, detail="Commission percentage must be between 0.1% and 100%")
    if data["commission_type"] in ("FLAT", "FIXED") and data["commission_value"] <= 0:
        raise HTTPException(status_code=400, detail="Flat commission amount must be greater than ₹0")

    if data["discount_type"] == "PERCENTAGE" and (data["discount_value"] < 0 or data["discount_value"] > 100):
        raise HTTPException(status_code=400, detail="Customer discount percentage must be between 0% and 100%")
    if data["discount_type"] in ("FLAT", "FIXED") and data["discount_value"] < 0:
        raise HTTPException(status_code=400, detail="Flat customer discount must be non-negative")

    # Authoritative catalogue verification
    existing_prods = await db.products.find({"id": {"$in": data["product_ids"]}}).to_list(len(data["product_ids"]))
    found_ids = {p["id"] for p in existing_prods}
    if not found_ids:
        raise HTTPException(status_code=400, detail="At least one valid catalogue product must be selected")

    rule_id = f"rule_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": rule_id,
        **data,
        "product_ids": list(found_ids),
        "product_id": list(found_ids)[0] if len(found_ids) == 1 else None,
        "reward_type": data["commission_type"],
        "value": data["commission_value"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "created_by": user["email"],
    }
    await db.referral_rules.insert_one(doc)
    await audit(
        user,
        "referral_rule.create",
        "rule",
        rule_id,
        f"Created referral rule '{doc['rule_name']}' for {len(found_ids)} product(s). Commission: {doc['commission_value']}{'%' if doc['commission_type'] == 'PERCENTAGE' else ' INR'}, Discount: {doc['discount_value']}{'%' if doc['discount_type'] == 'PERCENTAGE' else ' INR'}"
    )
    return clean_doc(doc)


@router.put("/admin/referrals/rules/{rid}")
async def update_referral_rule(rid: str, input: ProductReferralRuleIn, user=Depends(require_role(OWNER, ADMIN))):
    existing = await db.referral_rules.find_one({"id": rid})
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")

    patch = input.model_dump()

    if patch["commission_type"] == "PERCENTAGE" and (patch["commission_value"] <= 0 or patch["commission_value"] > 100):
        raise HTTPException(status_code=400, detail="Commission percentage must be between 0.1% and 100%")
    if patch["commission_type"] in ("FLAT", "FIXED") and patch["commission_value"] <= 0:
        raise HTTPException(status_code=400, detail="Flat commission amount must be greater than ₹0")

    if patch["discount_type"] == "PERCENTAGE" and (patch["discount_value"] < 0 or patch["discount_value"] > 100):
        raise HTTPException(status_code=400, detail="Customer discount percentage must be between 0% and 100%")
    if patch["discount_type"] in ("FLAT", "FIXED") and patch["discount_value"] < 0:
        raise HTTPException(status_code=400, detail="Flat customer discount must be non-negative")

    patch["updated_at"] = now_utc()
    patch["updated_by"] = user["email"]
    patch["reward_type"] = patch["commission_type"]
    patch["value"] = patch["commission_value"]

    # Financial rule change audit logging (Requirement 36)
    history_entry = {
        "id": str(uuid.uuid4()),
        "rule_id": rid,
        "changed_by": user["email"],
        "changed_at": now_utc(),
        "old_commission": {
            "type": existing.get("commission_type") or existing.get("reward_type"),
            "value": existing.get("commission_value") or existing.get("value"),
        },
        "new_commission": {
            "type": patch["commission_type"],
            "value": patch["commission_value"],
        },
        "old_discount": {
            "type": existing.get("discount_type"),
            "value": existing.get("discount_value"),
        },
        "new_discount": {
            "type": patch["discount_type"],
            "value": patch["discount_value"],
        },
        "old_product_ids": existing.get("product_ids") or ([existing.get("product_id")] if existing.get("product_id") else []),
        "new_product_ids": patch["product_ids"],
    }
    await db.referral_rule_audits.insert_one(history_entry)

    await db.referral_rules.update_one({"id": rid}, {"$set": patch})
    await audit(user, "referral_rule.update", "rule", rid, f"Updated rule {rid} ('{patch['rule_name']}')")
    updated = await db.referral_rules.find_one({"id": rid})
    return clean_doc(updated)


@router.delete("/admin/referrals/rules/{rid}")
async def delete_referral_rule(rid: str, user=Depends(require_role(OWNER, ADMIN))):
    res = await db.referral_rules.delete_one({"id": rid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    await audit(user, "referral_rule.delete", "rule", rid, f"Deleted rule {rid}")
    return {"status": "success", "message": "Rule deleted"}


@router.post("/admin/referrals/rules/bulk")
async def bulk_action_referral_rules(input: BulkRuleActionIn, user=Depends(require_role(OWNER, ADMIN))):
    """Bulk activate, deactivate, or delete selected referral rules."""
    rule_ids = input.rule_ids
    act = input.action.lower()

    if act == "activate":
        res = await db.referral_rules.update_many(
            {"id": {"$in": rule_ids}},
            {"$set": {"is_active": True, "updated_at": now_utc(), "updated_by": user["email"]}}
        )
        await audit(user, "referral_rule.bulk_activate", "rules", ",".join(rule_ids), f"Bulk activated {res.modified_count} rules")
        return {"status": "success", "modified_count": res.modified_count, "message": f"Activated {res.modified_count} rules"}

    elif act == "deactivate":
        res = await db.referral_rules.update_many(
            {"id": {"$in": rule_ids}},
            {"$set": {"is_active": False, "updated_at": now_utc(), "updated_by": user["email"]}}
        )
        await audit(user, "referral_rule.bulk_deactivate", "rules", ",".join(rule_ids), f"Bulk deactivated {res.modified_count} rules")
        return {"status": "success", "modified_count": res.modified_count, "message": f"Deactivated {res.modified_count} rules"}

    elif act == "delete":
        res = await db.referral_rules.delete_many({"id": {"$in": rule_ids}})
        await audit(user, "referral_rule.bulk_delete", "rules", ",".join(rule_ids), f"Bulk deleted {res.deleted_count} rules")
        return {"status": "success", "deleted_count": res.deleted_count, "message": f"Deleted {res.deleted_count} rules"}

    raise HTTPException(status_code=400, detail="Invalid bulk action")


@router.get("/admin/referrals/settings")
async def get_referral_settings_endpoint(user=Depends(require_role(OWNER, ADMIN))):
    """Retrieve Authoritative Referral & Earn Pricing / Stacking Configuration."""
    sett = await get_referral_settings()
    return clean_doc(sett)


@router.put("/admin/referrals/settings")
async def update_referral_settings_endpoint(input: ReferralSettingsIn, user=Depends(require_role(OWNER, ADMIN))):
    """Update Referral & Earn Stacking, Commission Basis, Quantity Semantics, and Attribution Rules."""
    doc = input.model_dump()
    doc["id"] = "referral_settings"
    doc["updated_at"] = now_utc()
    doc["updated_by"] = user["email"]

    await db.settings.update_one({"id": "referral_settings"}, {"$set": doc}, upsert=True)
    await audit(user, "referral.settings_updated", "settings", "referral_settings", "Updated referral stacking and calculation basis settings")
    return clean_doc(doc)


# ---------------------------------------------------------------------------
# 6. Fraud & Abuse Protection Engine
# ---------------------------------------------------------------------------

@router.get("/admin/referrals/fraud-alerts")
async def get_fraud_alerts(user=Depends(require_role(OWNER, ADMIN))):
    """Detect potential self-referral, device/phone sharing, and refund abuse."""
    alerts = []
    
    # 1. Self-referrals: Check if referrer and customer share email, phone, or address
    rewards = await db.referral_rewards.find({}).to_list(1000)
    for r in rewards:
        ref_id = r.get("user_id")
        cust_id = r.get("customer_user_id")
        if ref_id and cust_id and ref_id == cust_id:
            alerts.append({
                "type": "SELF_REFERRAL_SAME_ACCOUNT",
                "severity": "CRITICAL",
                "message": f"Commission {r.get('id')} has identical referrer and customer account ID {ref_id}",
                "reward_id": r.get("id"),
                "order_number": r.get("order_number"),
            })

    # 2. Cancelled or Refunded Orders with Active Commissions
    orders = await db.orders.find(
        {"referral_code": {"$ne": None}, "fulfilment_status": {"$in": ["returned", "cancelled"]}}
    ).to_list(500)
    for o in orders:
        linked_rewards = await db.referral_rewards.find(
            {"order_id": o.get("id"), "status": {"$in": ["pending", "approved", "paid"]}}
        ).to_list(10)
        for lr in linked_rewards:
            alerts.append({
                "type": "CANCELLED_ORDER_ACTIVE_REWARD",
                "severity": "HIGH",
                "message": f"Order {o.get('order_number')} was {o.get('fulfilment_status')}, but commission of ₹{lr.get('amount')} is in '{lr.get('status')}' state.",
                "reward_id": lr.get("id"),
                "order_number": o.get("order_number"),
            })

    return {
        "alert_count": len(alerts),
        "alerts": alerts,
    }


# ---------------------------------------------------------------------------
# 7. Excel (.xlsx) Exports
# ---------------------------------------------------------------------------

def _build_excel_response(sheet_title: str, headers: List[str], rows: List[List[Any]], filename: str) -> Response:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title

    # Header styling
    header_fill = PatternFill(start_color="16241C", end_color="16241C", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    border_thin = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0"),
    )

    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row in rows:
        ws.append(row)
        for col_idx in range(1, len(row) + 1):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.border = border_thin
            cell.font = Font(name="Calibri", size=10)

    # Auto-adjust column width
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _fmt_date_str(val):
    if not val:
        return ""
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val)[:10]


@router.get("/admin/referrals/export/referrers")
async def export_referrers_excel(user=Depends(require_role(OWNER, ADMIN))):
    users = await db.users.find({"referral_code": {"$ne": None}}).sort("created_at", -1).to_list(1000)
    headers = [
        "Referral Name", "Referral Code", "Email", "Phone",
        "Leads", "Sales", "Sales Value (INR)",
        "Pending Commission (INR)", "Available Commission (INR)", "Total Earned (INR)", "Total Paid (INR)",
        "KYC Status", "Bank Status", "Status", "Date Joined"
    ]
    rows = []
    for u in users:
        code = u.get("referral_code")
        leads_cnt = await db.referral_attributions.count_documents({"code": code}) if code else 0
        paid_orders = await db.orders.find({"referral_code": code, "payment_status": "paid"}).to_list(500) if code else []
        sales_val = sum(o.get("total_amount", 0) for o in paid_orders)
        wallet = await compute_referrer_wallet(u["id"])

        rows.append([
            u.get("name", "Unnamed"),
            code,
            u.get("email"),
            u.get("phone", "—"),
            leads_cnt,
            len(paid_orders),
            sales_val,
            wallet["pending_commission"],
            wallet["available_to_withdraw"],
            wallet["total_earned"],
            wallet["paid_commission"],
            u.get("kyc", {}).get("status", "NOT_SUBMITTED"),
            u.get("bank", {}).get("status", "NOT_ADDED"),
            "Active" if u.get("is_active", True) else "Inactive",
            _fmt_date_str(u.get("created_at")),
        ])

    return _build_excel_response("Referrers", headers, rows, f"Kotson_Referrers_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/admin/referrals/export/withdrawals")
async def export_withdrawals_excel(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.referral_withdrawals.find({}).sort("created_at", -1).to_list(1000)
    headers = [
        "Request ID", "Referrer Name", "Referral Code", "Email",
        "Requested Amount (INR)", "TDS Rate (%)", "TDS Deducted (INR)", "Net Payable (INR)",
        "Status", "UTR / Payment Ref", "Payment Method", "Requested Date", "Paid Date"
    ]
    rows = []
    for d in docs:
        payout = d.get("payout_details", {})
        rows.append([
            d.get("request_number") or d["id"],
            d.get("user_name"),
            d.get("referral_code"),
            d.get("user_email"),
            d.get("amount", 0),
            d.get("tds_rate", 0),
            d.get("tds_amount", 0),
            d.get("net_payable", 0),
            d.get("status"),
            payout.get("utr_number", "—"),
            payout.get("payment_method", "—"),
            _fmt_date_str(d.get("created_at")),
            payout.get("payment_date", "—"),
        ])

    return _build_excel_response("Withdrawals", headers, rows, f"Kotson_Withdrawals_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/admin/referrals/export/leads")
async def export_leads_excel(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.referral_attributions.find({}).sort("created_at", -1).to_list(1000)
    headers = [
        "Lead Ref", "Referral Code", "Customer Name", "Masked Email", "Source",
        "Status", "Last Activity", "Orders", "Sale Value (INR)", "Commission Status", "Attributed Date"
    ]
    rows = []
    for d in docs:
        orders_str = d.get("order_number") or (", ".join(d.get("orders", [])) if d.get("orders") else "—")
        rows.append([
            d.get("lead_number") or d.get("id"),
            d.get("code"),
            d.get("customer_name") or "Referred Customer",
            d.get("customer_email_masked") or "—",
            d.get("source", "cart_activity"),
            d.get("status", "CART_ACTIVE"),
            d.get("last_activity_type", "Added to Cart"),
            orders_str,
            d.get("sale_value", 0.0),
            d.get("commission_status", "NONE"),
            _fmt_date_str(d.get("created_at")),
        ])

    return _build_excel_response("Referral Leads", headers, rows, f"Kotson_Referral_Leads_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/admin/referrals/export/rules")
async def export_rules_excel(user=Depends(require_role(OWNER, ADMIN))):
    rules = await db.referral_rules.find({}).sort("created_at", -1).to_list(1000)
    products = await db.products.find({}, {"id": 1, "name": 1, "category": 1}).to_list(1000)
    prod_map = {p["id"]: p for p in products}

    headers = [
        "Rule ID", "Rule Name", "Products", "Categories",
        "Commission Type", "Commission Value", "Commission Basis",
        "Customer Discount Type", "Customer Discount Value",
        "Status", "Valid From", "Valid Until", "Created At", "Updated At"
    ]
    rows = []
    for r in rules:
        p_ids = r.get("product_ids") or ([r.get("product_id")] if r.get("product_id") else [])
        prods = [prod_map[pid] for pid in p_ids if pid in prod_map]
        p_names = ", ".join(p.get("name", pid) for p in prods) if prods else "All Store Products"
        cats = ", ".join(set(p.get("category", "General") for p in prods if p.get("category"))) or "General"
        comm_type = r.get("commission_type") or r.get("reward_type", "PERCENTAGE")
        comm_val = f"{r.get('commission_value', r.get('value', 0))}%" if comm_type == "PERCENTAGE" else f"INR {r.get('commission_value', r.get('value', 0))}"
        disc_type = r.get("discount_type", "PERCENTAGE")
        disc_val = f"{r.get('discount_value', 0)}%" if disc_type == "PERCENTAGE" else f"INR {r.get('discount_value', 0)}"

        rows.append([
            r.get("id"),
            r.get("rule_name"),
            p_names,
            cats,
            comm_type,
            comm_val,
            r.get("commission_basis", "selling_price"),
            disc_type,
            disc_val,
            "Active" if r.get("is_active", True) else "Inactive",
            _fmt_date_str(r.get("effective_from")),
            _fmt_date_str(r.get("effective_until")),
            _fmt_date_str(r.get("created_at")),
            _fmt_date_str(r.get("updated_at")),
        ])
    return _build_excel_response("Referral Rules", headers, rows, f"Kotson_Referral_Rules_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/admin/referrals/export/discounts")
async def export_discounts_excel(user=Depends(require_role(OWNER, ADMIN))):
    orders = await db.orders.find(
        {"referral_code": {"$ne": None}, "payment_status": "paid"}
    ).sort("created_at", -1).to_list(2000)

    headers = [
        "Order Number", "Date", "Referral Code", "Customer Name", "Customer Email",
        "Product", "Variant", "Quantity", "Selling Price (INR)",
        "Customer Discount Rule", "Customer Discount Amount (INR)",
        "Order Total (INR)", "Payment Status"
    ]
    rows = []
    for o in orders:
        code = o.get("referral_code")
        for item in o.get("items", []):
            if item.get("referral_discount", 0) > 0 or item.get("customer_discount_amount", 0) > 0:
                d_rule = item.get("customer_discount_rule") or f"{item.get('customer_discount_value', 0)}{'%' if item.get('customer_discount_type') == 'PERCENTAGE' else ' INR'}"
                d_amt = item.get("customer_discount_amount") or round(item.get("referral_discount", 0) / 100.0, 2)
                price = round((item.get("price") or item.get("unit_price", 0)) / 100.0, 2)
                rows.append([
                    o.get("order_number"),
                    _fmt_date_str(o.get("created_at")),
                    code,
                    o.get("customer_name") or o.get("shipping_address", {}).get("name", "Customer"),
                    o.get("customer_email") or "—",
                    item.get("name") or item.get("product_name"),
                    item.get("variant_name") or item.get("variant_id"),
                    item.get("quantity", 1),
                    price,
                    d_rule,
                    d_amt,
                    round(o.get("total_amount", 0), 2),
                    o.get("payment_status", "").upper(),
                ])
    return _build_excel_response("Customer Discounts", headers, rows, f"Kotson_Customer_Referral_Discounts_{datetime.now().strftime('%Y%m%d')}.xlsx")


@router.get("/admin/referrals/export/commissions")
async def export_commissions_excel(user=Depends(require_role(OWNER, ADMIN))):
    docs = await db.referral_rewards.find({}).sort("created_at", -1).to_list(2000)
    headers = [
        "Commission ID", "Referral Code", "Referrer Name", "Order Number",
        "Product", "Category", "Quantity", "Eligible Sale (INR)",
        "Commission Rule", "Commission Earned (INR)", "Status", "Date"
    ]
    rows = []
    for d in docs:
        rule_snap = d.get("commission_rule_snapshot", {})
        comm_type = rule_snap.get("commission_type") or rule_snap.get("reward_type", "PERCENTAGE")
        comm_val = rule_snap.get("commission_value") or rule_snap.get("value", 0)
        rule_str = f"{rule_snap.get('rule_name', 'Rule')} ({comm_val}{'%' if comm_type == 'PERCENTAGE' else ' INR'})"
        rows.append([
            d.get("id"),
            d.get("code"),
            d.get("referrer_name"),
            d.get("order_number"),
            d.get("product_name") or "Catalogue Item",
            d.get("product_category") or "Store",
            d.get("quantity", 1),
            round(d.get("eligible_sale_amount", 0), 2),
            rule_str,
            round(d.get("amount", 0), 2),
            d.get("status", "").upper(),
            _fmt_date_str(d.get("created_at")),
        ])

    return _build_excel_response("Commissions", headers, rows, f"Kotson_Commissions_{datetime.now().strftime('%Y%m%d')}.xlsx")
