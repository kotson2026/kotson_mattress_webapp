"""Authoritative seed data for Refer & Earn Module:
Seeds realistic referrers, leads, sales, commissions, KYC, and withdrawals matching specification.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from lib.db import db
from lib.security import hash_password, now_utc, mint_referral_code

logger = logging.getLogger(__name__)


def mask_pan(pan: str) -> str:
    if not pan or len(pan) < 6:
        return pan or ""
    return f"{pan[:5]}****{pan[-1]}"


def mask_account(acc: str) -> str:
    if not acc or len(acc) < 4:
        return acc or ""
    return f"XXXXXX{acc[-4:]}"


async def ensure_referral_system_seed() -> None:
    """Ensure baseline rules, tax settings, and realistic demo referrers exist."""
    now = datetime.now(timezone.utc)

    # 1. Default Commission Rule
    rule = await db.referral_rules.find_one({"is_active": True})
    if not rule:
        default_rule = {
            "id": "rule_global_standard_5pct",
            "rule_name": "Standard 5% Organic Mattress Referral",
            "reward_type": "PERCENTAGE",
            "value": 5.0,
            "min_order_value": 0.0,
            "product_id": None,  # Global Tier
            "first_order_only": False,
            "is_active": True,
            "effective_from": (now - timedelta(days=180)).strftime("%Y-%m-%d"),
            "effective_until": None,
            "notes": "Global 5% commission on all organic latex mattresses and sleep accessories.",
            "created_at": (now - timedelta(days=180)).isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.referral_rules.insert_one(default_rule)
        logger.info("Seeded default referral commission rule: %s", default_rule["rule_name"])

    # 2. Statutory TDS Settings (Section 393 Income-tax Act 2025)
    tax_settings = await db.settings.find_one({"id": "referral_tax"})
    if not tax_settings:
        default_tax = {
            "id": "referral_tax",
            "tds_enabled": True,
            "payment_nature": "Commission / Brokerage - Section 393, Income-tax Act 2025",
            "pan_available_rate": 5.0,
            "pan_not_available_rate": 20.0,
            "applicable_threshold": 15000.0,
            "effective_from": "2026-04-01",
            "effective_until": None,
            "notes": "Statutory non-salary withholding rate configured per Section 393 compliance. Verified with accounting.",
            "updated_at": now.isoformat(),
            "updated_by": "system",
        }
        await db.settings.insert_one(default_tax)
        logger.info("Seeded statutory TDS configuration for Refer & Earn.")

    # 3. Realistic Demo Referrers
    # Check if Kranthi Kumar exists
    kranthi = await db.users.find_one({"referral_code": "KOT-KRA123"})
    kranthi_id = kranthi["id"] if kranthi else "ref_user_kranthi_01"
    priya_id = "ref_user_priya_02"
    joined_date = (now - timedelta(days=90)).isoformat()
    if not kranthi:
        kranthi_doc = {
            "id": kranthi_id,
            "email": "kranthi.kumar@example.com",
            "name": "Kranthi Kumar",
            "phone": "+919876543210",
            "password_hash": hash_password("Kotson-Refer-2026!"),
            "roles": ["customer"],
            "referral_code": "KOT-KRA123",
            "referred_by": None,
            "is_active": True,
            "created_at": joined_date,
            "updated_at": now.isoformat(),
            "kyc": {
                "pan_number": "ABCDE1234F",
                "pan_masked": mask_pan("ABCDE1234F"),
                "pan_name": "Kranthi Kumar",
                "status": "VERIFIED",
                "verified_at": (now - timedelta(days=60)).isoformat(),
                "verified_by": "hello@kotsonmattress.com",
            },
            "bank": {
                "account_holder_name": "Kranthi Kumar",
                "account_number": "123456789012",
                "account_number_masked": mask_account("123456789012"),
                "ifsc_code": "HDFC0001234",
                "bank_name": "HDFC Bank",
                "branch": "Indiranagar, Bangalore",
                "status": "VERIFIED",
                "verified_at": (now - timedelta(days=60)).isoformat(),
                "verified_by": "hello@kotsonmattress.com",
            },
        }
        await db.users.insert_one(kranthi_doc)

    if (await db.referral_rewards.count_documents({"code": "KOT-KRA123"})) == 0:
        await db.referral_attributions.delete_many({"code": "KOT-KRA123"})
        # 42 leads for Kranthi
        for i in range(1, 43):
            lead_date = (now - timedelta(days=90 - (i * 2))).isoformat()
            is_converted = i <= 8
            lead_doc = {
                "id": f"lead_kra_{i:03d}",
                "customer_id": f"cust_kra_{i:03d}",
                "code": "KOT-KRA123",
                "owner_user_id": kranthi_id,
                "customer_name": f"Lead Customer {i:02d}",
                "customer_email_masked": f"cust{i:02d}****@example.com",
                "customer_phone_masked": f"+919876****{i:02d}",
                "source": "link_click" if i % 2 == 0 else "signup",
                "status": "CONVERTED" if is_converted else "LEAD_ATTRIBUTED",
                "order_number": f"KT-ORD-10{i:02d}" if is_converted else None,
                "sale_value": 10750.0 if is_converted else None,
                "created_at": lead_date,
                "converted_at": lead_date if is_converted else None,
            }
            await db.referral_attributions.insert_one(lead_doc)

        # 8 sales and commissions for Kranthi (Total sales: ₹86,000; Total earned: ₹5,600)
        # Sales breakdown:
        # 1-3: Paid out (₹2,000 total commission, sales value ₹30,000)
        # 4-6: Approved & Available (₹2,400 total commission, sales value ₹38,000)
        # 7-8: Pending (₹1,200 total commission, sales value ₹18,000)
        commissions_spec = [
            ("KT-ORD-1001", 10000.0, 700.0, "PAID", 75),
            ("KT-ORD-1002", 10000.0, 700.0, "PAID", 70),
            ("KT-ORD-1003", 10000.0, 600.0, "PAID", 65),
            ("KT-ORD-1004", 12000.0, 800.0, "APPROVED", 40),
            ("KT-ORD-1005", 14000.0, 900.0, "APPROVED", 30),
            ("KT-ORD-1006", 12000.0, 700.0, "APPROVED", 20),
            ("KT-ORD-1007", 9000.0, 600.0, "PENDING", 10),
            ("KT-ORD-1008", 9000.0, 600.0, "PENDING", 3),
        ]

        wid_paid = "KW-2026-0001"
        for idx, (ord_num, sale_val, comm_val, status, days_ago) in enumerate(commissions_spec, 1):
            c_date = (now - timedelta(days=days_ago)).isoformat()
            if not await db.orders.find_one({"order_number": ord_num}):
                await db.orders.insert_one({
                    "id": f"ord_kra_{idx:03d}",
                    "order_number": ord_num,
                    "user_id": f"cust_kra_{idx:03d}",
                    "email": f"cust{idx:02d}@example.com",
                    "referral_code": "KOT-KRA123",
                    "payment_status": "paid",
                    "fulfilment_status": "delivered",
                    "total_amount": sale_val,
                    "amounts": {"subtotal": sale_val, "total": sale_val},
                    "created_at": c_date,
                    "updated_at": c_date,
                })
            comm_doc = {
                "id": f"comm_kra_{idx:03d}",
                "user_id": kranthi_id,
                "code": "KOT-KRA123",
                "referrer_name": "Kranthi Kumar",
                "order_number": ord_num,
                "order_id": f"ord_kra_{idx:03d}",
                "eligible_sale_amount": sale_val,
                "commission_rule_snapshot": {
                    "rule_id": "rule_global_standard_5pct",
                    "rule_name": "Standard 5% Organic Mattress Referral",
                    "reward_type": "PERCENTAGE",
                    "value": round((comm_val / sale_val) * 100, 1),
                },
                "amount": comm_val,
                "gross_commission_amount": comm_val,
                "status": status.lower(),
                "created_at": c_date,
                "approved_at": c_date if status in ("PAID", "APPROVED") else None,
                "approved_by": "hello@kotsonmattress.com" if status in ("PAID", "APPROVED") else None,
                "paid_at": c_date if status == "PAID" else None,
                "withdrawal_id": wid_paid if status == "PAID" else None,
            }
            await db.referral_rewards.insert_one(comm_doc)

        # 1 Paid Withdrawal for Kranthi (₹2,000)
        w_paid = {
            "id": wid_paid,
            "request_number": "KW-2026-0001",
            "user_id": kranthi_id,
            "referral_code": "KOT-KRA123",
            "user_name": "Kranthi Kumar",
            "user_email": "kranthi.kumar@example.com",
            "user_phone": "+919876543210",
            "amount": 2000.0,
            "requested_amount": 2000.0,
            "tds_rate": 5.0,
            "tds_amount": 100.0,
            "net_payable": 1900.0,
            "tds_rule_snapshot": {
                "tds_enabled": True,
                "rate_applied": 5.0,
                "nature_of_payment": "Section 393 Compliance",
                "pan_available": True,
            },
            "bank_details_snapshot": {
                "account_holder_name": "Kranthi Kumar",
                "account_number_masked": "XXXXXX9012",
                "ifsc_code": "HDFC0001234",
                "bank_name": "HDFC Bank",
            },
            "pan_details_snapshot": {
                "pan_masked": "ABCDE****F",
                "pan_name": "Kranthi Kumar",
            },
            "kyc_status_at_request": "VERIFIED",
            "status": "PAID",
            "payout_details": {
                "utr_number": "HDFC2026090123",
                "payment_method": "NEFT/RTGS",
                "payment_date": (now - timedelta(days=50)).strftime("%Y-%m-%d"),
                "note": "Processed via HDFC Corporate Banking",
                "paid_by": "hello@kotsonmattress.com",
            },
            "created_at": (now - timedelta(days=55)).isoformat(),
            "updated_at": (now - timedelta(days=50)).isoformat(),
            "approved_at": (now - timedelta(days=52)).isoformat(),
            "approved_by": "hello@kotsonmattress.com",
        }
        await db.referral_withdrawals.insert_one(w_paid)

        # 1 Pending Withdrawal for Priya Sharma (₹1,000)
        wid_pending = "KW-2026-0002"
        w_pending = {
            "id": wid_pending,
            "request_number": "KW-2026-0002",
            "user_id": priya_id,
            "referral_code": "KOT-PRI456",
            "user_name": "Priya Sharma",
            "user_email": "priya.sharma@example.com",
            "user_phone": "+919876543211",
            "amount": 1000.0,
            "requested_amount": 1000.0,
            "tds_rate": 5.0,
            "tds_amount": 50.0,
            "net_payable": 950.0,
            "tds_rule_snapshot": {
                "tds_enabled": True,
                "rate_applied": 5.0,
                "nature_of_payment": "Section 393 Compliance",
                "pan_available": True,
            },
            "bank_details_snapshot": {
                "account_holder_name": "Priya Sharma",
                "account_number_masked": "XXXXXX4321",
                "ifsc_code": "ICIC0002468",
                "bank_name": "ICICI Bank",
            },
            "pan_details_snapshot": {
                "pan_masked": "PQRSK****L",
                "pan_name": "Priya Sharma",
            },
            "kyc_status_at_request": "VERIFIED",
            "status": "REQUESTED",
            "created_at": (now - timedelta(days=2)).isoformat(),
            "updated_at": (now - timedelta(days=2)).isoformat(),
        }
        await db.referral_withdrawals.insert_one(w_pending)

        # Seed Kranthi's wallet ledger
        ledger_entries = [
            {"type": "COMMISSION_APPROVED", "amount": 2000.0, "ref": "KW-2026-0001-setup", "notes": "Commissions cleared"},
            {"type": "WITHDRAWAL_RESERVED", "amount": 2000.0, "ref": wid_paid, "notes": "Withdrawal requested KW-2026-0001"},
            {"type": "PAYOUT_PAID", "amount": 1900.0, "ref": wid_paid, "notes": "Paid UTR: HDFC2026090123 (TDS ₹100)"},
            {"type": "COMMISSION_APPROVED", "amount": 2400.0, "ref": "comm_batch_02", "notes": "Sales commissions cleared"},
            {"type": "COMMISSION_PENDING", "amount": 1200.0, "ref": "comm_batch_03", "notes": "Recent orders awaiting return-lock"},
        ]
        for idx, entry in enumerate(ledger_entries):
            await db.wallet_ledger.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": kranthi_id,
                "code": "KOT-KRA123",
                "transaction_type": entry["type"],
                "amount": entry["amount"],
                "reference_id": entry["ref"],
                "notes": entry["notes"],
                "created_at": (now - timedelta(days=50 - (idx * 5))).isoformat(),
                "created_by": "system",
            })

    # Referrer 2: Priya Sharma (Pending Verification KYC)
    priya = await db.users.find_one({"referral_code": "KOT-PRI456"})
    if not priya:
        priya_id = "ref_user_priya_02"
        priya_doc = {
            "id": priya_id,
            "email": "priya.sharma@example.com",
            "name": "Priya Sharma",
            "phone": "+919876543211",
            "password_hash": hash_password("Kotson-Refer-2026!"),
            "roles": ["customer"],
            "referral_code": "KOT-PRI456",
            "referred_by": None,
            "is_active": True,
            "created_at": (now - timedelta(days=45)).isoformat(),
            "updated_at": now.isoformat(),
            "kyc": {
                "pan_number": "BNKPS5678K",
                "pan_masked": mask_pan("BNKPS5678K"),
                "pan_name": "Priya Sharma",
                "status": "PENDING_VERIFICATION",
            },
            "bank": {
                "account_holder_name": "Priya Sharma",
                "account_number": "987654321098",
                "account_number_masked": mask_account("987654321098"),
                "ifsc_code": "ICIC0002468",
                "bank_name": "ICICI Bank",
                "status": "VERIFIED",
                "verified_at": (now - timedelta(days=20)).isoformat(),
                "verified_by": "hello@kotsonmattress.com",
            },
        }
        await db.users.insert_one(priya_doc)

        for i in range(1, 19):
            is_converted = i <= 4
            await db.referral_attributions.insert_one({
                "id": f"lead_pri_{i:03d}",
                "customer_id": f"cust_pri_{i:03d}",
                "code": "KOT-PRI456",
                "owner_user_id": priya_id,
                "customer_name": f"Priya Referral {i:02d}",
                "customer_email_masked": f"priya.ref{i:02d}****@example.com",
                "customer_phone_masked": f"+919875****{i:02d}",
                "source": "link_click",
                "status": "CONVERTED" if is_converted else "LEAD_ATTRIBUTED",
                "order_number": f"KT-ORD-20{i:02d}" if is_converted else None,
                "sale_value": 10500.0 if is_converted else None,
                "created_at": (now - timedelta(days=45 - (i * 2))).isoformat(),
                "converted_at": (now - timedelta(days=45 - (i * 2))).isoformat() if is_converted else None,
            })

        for i in range(1, 5):
            c_status = "approved" if i <= 2 else "pending"
            ord_date = (now - timedelta(days=20 - (i * 4))).isoformat()
            if not await db.orders.find_one({"order_number": f"KT-ORD-20{i:02d}"}):
                await db.orders.insert_one({
                    "id": f"ord_pri_{i:03d}",
                    "order_number": f"KT-ORD-20{i:02d}",
                    "user_id": f"cust_pri_{i:03d}",
                    "email": f"priya.cust{i:02d}@example.com",
                    "referral_code": "KOT-PRI456",
                    "payment_status": "paid",
                    "fulfilment_status": "delivered",
                    "total_amount": 10500.0,
                    "amounts": {"subtotal": 10500.0, "total": 10500.0},
                    "created_at": ord_date,
                    "updated_at": ord_date,
                })
            await db.referral_rewards.insert_one({
                "id": f"comm_pri_{i:03d}",
                "user_id": priya_id,
                "code": "KOT-PRI456",
                "referrer_name": "Priya Sharma",
                "order_number": f"KT-ORD-20{i:02d}",
                "eligible_sale_amount": 10500.0,
                "commission_rule_snapshot": {
                    "rule_id": "rule_global_standard_5pct",
                    "rule_name": "Standard 5% Organic Mattress Referral",
                    "reward_type": "PERCENTAGE",
                    "value": 5.0,
                },
                "amount": 525.0,
                "gross_commission_amount": 525.0,
                "status": c_status,
                "created_at": ord_date,
                "approved_at": ord_date if c_status == "approved" else None,
            })

    # Referrer 3: Amit Patel (Needs Correction)
    amit = await db.users.find_one({"referral_code": "KOT-AMI789"})
    if not amit:
        amit_id = "ref_user_amit_03"
        await db.users.insert_one({
            "id": amit_id,
            "email": "amit.patel@example.com",
            "name": "Amit Patel",
            "phone": "+919876543212",
            "password_hash": hash_password("Kotson-Refer-2026!"),
            "roles": ["customer"],
            "referral_code": "KOT-AMI789",
            "referred_by": None,
            "is_active": True,
            "created_at": (now - timedelta(days=30)).isoformat(),
            "updated_at": now.isoformat(),
            "kyc": {
                "pan_number": "ABCDP9999Z",
                "pan_masked": mask_pan("ABCDP9999Z"),
                "pan_name": "Amit Kumar Patel",
                "status": "NEEDS_CORRECTION",
                "rejection_reason": "Name on PAN does not match identity records. Please re-upload.",
            },
            "bank": {
                "status": "NOT_ADDED",
            },
        })

    # Run migration on all registered users to ensure 100% unique referral code coverage
    await migrate_user_referral_codes()

    logger.info("Referral system seed completed successfully.")


async def migrate_user_referral_codes() -> dict:
    """Audit all registered users to ensure each has exactly ONE UNIQUE, STABLE referral code.
    - Preserves existing valid unique codes.
    - Lazily mints codes for users lacking one.
    - Resolves duplicates deterministically (keeps oldest user, generates fresh unique code for duplicate).
    - Idempotent and backward-compatible.
    """
    users = await db.users.find({}).sort("created_at", 1).to_list(10000)
    seen_codes: set[str] = set()
    migrated_count = 0
    duplicate_count = 0

    for user in users:
        code = (user.get("referral_code") or "").strip().upper()
        needs_new_code = False

        if not code:
            needs_new_code = True
        elif code in seen_codes:
            duplicate_count += 1
            needs_new_code = True
        else:
            seen_codes.add(code)

        if needs_new_code:
            new_code = None
            for _ in range(50):
                candidate = mint_referral_code()
                if candidate not in seen_codes and not await db.users.find_one({"referral_code": candidate}):
                    new_code = candidate
                    break
            if not new_code:
                new_code = f"KS{uuid.uuid4().hex[:6].upper()}"

            seen_codes.add(new_code)
            await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": new_code}})
            migrated_count += 1
            logger.info("Assigned unique referral code %s to user %s (%s)", new_code, user["id"], user.get("email"))

    logger.info("Referral code migration finished: %d total users audited, %d codes assigned, %d duplicates resolved.", len(users), migrated_count, duplicate_count)
    return {"audited": len(users), "migrated": migrated_count, "duplicates": duplicate_count}
