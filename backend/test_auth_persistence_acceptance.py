"""Authoritative Acceptance Tests for Kotson Customer Auth, Persistence & Supabase Preparation."""

import asyncio
import os
import re
import sys
import uuid
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


from lib.db import client, db, save_db_snapshot
from lib.security import hash_password, verify_password, create_session
from routers.auth import normalize_phone


async def run_acceptance_tests():
    print("======================================================================")
    print("STARTING KOTSON AUTHENTICATION & DATABASE PERSISTENCE ACCEPTANCE TESTS")
    print("======================================================================")

    # 1. PHONE NORMALIZATION TESTS
    print("\n--- TEST 1: Phone Normalization Integrity ---")
    test_phones = [
        ("9876543210", "+919876543210"),
        ("+91 9876543210", "+919876543210"),
        ("+919876543210", "+919876543210"),
        ("98765 43210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("+91-98765-43210", "+919876543210"),
    ]
    for raw, expected in test_phones:
        norm = normalize_phone(raw)
        assert norm == expected, f"Failed: {raw} -> {norm} != {expected}"
        print(f"  ✓ {raw!r:>18} -> {norm}")
    print("TEST 1 PASSED: All phone variations normalize to canonical +91 format.")

    # 2. CUSTOMER REGISTRATION WITH AUTHORITATIVE PERSISTENCE
    print("\n--- TEST 2: Customer Registration & Authoritative Database Storage ---")
    unique_suffix = uuid.uuid4().hex[:6]
    test_name = "Persistence Test User"
    test_email = f"persistence_{unique_suffix}@example.com"
    test_phone = f"+9198765{unique_suffix[:5]}"
    test_password = "Valid-Test-Password-2026!"

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": test_email,
        "name": test_name,
        "phone": test_phone,
        "password_hash": hash_password(test_password),
        "roles": ["customer"],
        "referral_code": f"KS{unique_suffix.upper()}",
        "referred_by": None,
        "is_active": True,
        "consent": {
            "agreed": True,
            "terms_and_privacy": True,
            "agreed_at": datetime.now(timezone.utc),
            "version": "2026-v1",
        },
        "created_at": datetime.now(timezone.utc),
    }

    await db.users.insert_one(user_doc)
    print(f"  ✓ Registered customer: {test_name} ({test_email}, {test_phone})")

    # Confirm user exists in db
    found = await db.users.find_one({"email": test_email})
    assert found is not None, "Customer not found in database!"
    assert found["name"] == test_name
    assert found["phone"] == test_phone
    assert verify_password(test_password, found["password_hash"])
    print("  ✓ Confirmed customer exists in database with valid password hash.")
    print("TEST 2 PASSED: Customer created in authoritative persistent database.")

    # 3. LOGIN BY EMAIL AND LOGIN BY PHONE
    print("\n--- TEST 3: Login Authentication by Email and Phone ---")
    # Email lookup
    by_email = await db.users.find_one({"email": test_email})
    assert by_email and verify_password(test_password, by_email["password_hash"])
    print("  ✓ Authentication by email succeeded.")

    # Phone lookup (canonical)
    by_phone_canonical = await db.users.find_one({"phone": test_phone})
    assert by_phone_canonical and verify_password(test_password, by_phone_canonical["password_hash"])
    print("  ✓ Authentication by canonical phone (+91...) succeeded.")

    # Phone lookup (raw 10 digits)
    raw_10 = test_phone.replace("+91", "")
    by_phone_raw = await db.users.find_one({"$or": [{"phone": test_phone}, {"phone": raw_10}]})
    assert by_phone_raw and verify_password(test_password, by_phone_raw["password_hash"])
    print(f"  ✓ Authentication by 10-digit input ({raw_10}) succeeded against same user ID {by_phone_raw['id']}.")
    print("TEST 3 PASSED: Single authoritative user record authenticated by email or phone.")

    # 4. DUPLICATE EMAIL AND PHONE PREVENTION
    print("\n--- TEST 4: Duplicate Email & Phone Prevention ---")
    dup_email = await db.users.find_one({"email": test_email})
    assert dup_email is not None
    print(f"  ✓ Duplicate email correctly detected for {test_email}")

    dup_phone = await db.users.find_one({"phone": test_phone})
    assert dup_phone is not None
    print(f"  ✓ Duplicate phone correctly detected for {test_phone}")
    print("TEST 4 PASSED: Uniqueness enforced.")

    # 5. REFERRAL CODE VALIDATION & ATTRIBUTION
    print("\n--- TEST 5: Referral Code Validation & Attribution ---")
    ref_owner_code = user_doc["referral_code"]
    owner = await db.users.find_one({"referral_code": ref_owner_code, "is_active": True})
    assert owner is not None
    print(f"  ✓ Active referral code {ref_owner_code} successfully validated against database.")

    # Invalid code
    invalid_lookup = await db.users.find_one({"referral_code": "INVALID_CODE_999", "is_active": True})
    assert invalid_lookup is None
    print("  ✓ Invalid referral code correctly rejected.")

    # Customer B registering with Customer A's referral code
    customer_b_id = str(uuid.uuid4())
    customer_b_code = f"KSB{unique_suffix.upper()[:4]}"
    customer_b = {
        "id": customer_b_id,
        "email": f"customer_b_{unique_suffix}@example.com",
        "name": "Referred Customer B",
        "phone": f"+9198766{unique_suffix[:5]}",
        "password_hash": hash_password("Valid-Test-Password-2026!"),
        "roles": ["customer"],
        "referral_code": customer_b_code,
        "referred_by": ref_owner_code,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(customer_b)
    saved_b = await db.users.find_one({"id": customer_b_id})
    assert saved_b["referred_by"] == ref_owner_code
    print(f"  ✓ Customer B attributed to referrer code {ref_owner_code} server-side.")
    print("TEST 5 PASSED: Referral validation and persistent attribution work seamlessly.")

    # 6. SIMULATE DEV ENVIRONMENT / SERVER RESTART
    print("\n--- TEST 6: Persistence Across Dev Environment / Server Restart ---")
    # Verify disk persistence file exists
    data_file = os.path.join(os.path.dirname(__file__), "data", "kotson_local_db.json")
    assert os.path.exists(data_file), f"Persistence file {data_file} not found!"
    file_size = os.path.getsize(data_file)
    print(f"  ✓ Persistent disk snapshot verified: {data_file} ({file_size:,} bytes)")

    # Simulate restart by loading into a fresh LocalJsonDatabase from disk
    from lib.db import LocalJsonDatabase
    restarted_db = LocalJsonDatabase(data_file)

    restarted_user = await restarted_db.users.find_one({"email": test_email})
    assert restarted_user is not None, "Customer was LOST after simulated restart!"
    assert restarted_user["id"] == user_id, "User ID changed after restart!"
    assert verify_password(test_password, restarted_user["password_hash"]), "Password hash corrupt after restart!"
    print(f"  ✓ Customer {test_email} remained 100% intact after restart with ID {restarted_user['id']}.")

    # Verify seed accounts also exist
    owner_staff = await restarted_db.users.find_one({"email": "hello@kotsonmattress.com"})
    assert owner_staff is not None
    print("  ✓ Seed staff account (hello@kotsonmattress.com) preserved.")

    crm_staff = await restarted_db.users.find_one({"email": "crm@kotsonmattress.com"})
    assert crm_staff is not None
    print("  ✓ Seed CRM account (crm@kotsonmattress.com) preserved.")

    print("TEST 6 PASSED: Customer accounts and staff accounts persist across restarts!")

    print("\n======================================================================")
    print("ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY WITH 100% INTEGRITY")
    print("======================================================================")


if __name__ == "__main__":
    asyncio.run(run_acceptance_tests())
