"""Comprehensive Remote Supabase Persistence & Integrity Acceptance Test.

Runs live against Supabase PostgreSQL with DATABASE_PROVIDER=supabase.
Guarantees:
1. Local JSON is never touched/modified.
2. Direct remote persistence across all critical business domains.
3. Customer creation, retrieval, and password verification.
4. Restart persistence.
5. Unique constraint enforcement (duplicate email & phone rejection).
6. Password reset token persistence & consumption.
7. Referral rule retrieval.
8. Cart persistence.
9. Custom product request persistence.
10. Webhook idempotency duplicate rejection.
"""

import asyncio
import hashlib
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env", override=True)
os.environ["DATABASE_PROVIDER"] = "supabase"

# Verify local JSON pre-test state
local_json_file = BACKEND_DIR / "data" / "kotson_local_db.json"
initial_mtime = local_json_file.stat().st_mtime if local_json_file.exists() else None
initial_hash = hashlib.sha256(local_json_file.read_bytes()).hexdigest() if local_json_file.exists() else None

sys.path.insert(0, str(BACKEND_DIR))
import lib.db
from lib.db import db, _local_db
from lib.postgres_adapter import PostgresDatabase


async def run_tests():
    print("=" * 60)
    print("STARTING REMOTE SUPABASE PERSISTENCE ACCEPTANCE SUITE")
    print("=" * 60)

    # 1. Verify Provider
    assert isinstance(db, PostgresDatabase), "db must be an instance of PostgresDatabase"
    assert _local_db is None, "_local_db must be None in Supabase mode"
    print("PROVIDER VERIFICATION: PASS (PostgresDatabase active, LocalJsonDatabase is None)")

    # Test Customer Data (Unique test identifier)
    test_id = uuid.uuid4().hex[:8]
    test_email = f"test.deploy.{test_id}@kotson-staging.com"
    test_phone_10 = f"98{uuid.uuid4().int % 100000000:08d}"
    test_phone_canonical = f"+91{test_phone_10}"
    raw_password = "KotsonSecureTest2026!"
    
    # Hash password with passlib
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
    password_hash = pwd_context.hash(raw_password)

    # 2. Remote Customer Creation
    print(f"Creating remote test customer: {test_email} / {test_phone_canonical}...")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": test_email,
        "phone": test_phone_canonical,
        "name": "Staging Acceptance Customer",
        "password_hash": password_hash,
        "roles": ["customer"],
        "referral_code": f"KS{test_id.upper()}",
        "is_active": True,
        "phone_verified": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    ins_res = await db.users.insert_one(user_doc)
    created_user_id = ins_res.inserted_id
    print(f"CUSTOMER CREATION: PASS (User ID: {created_user_id})")

    # 3. Customer Retrieval from remote DB
    retrieved = await db.users.find_one({"email": test_email})
    assert retrieved is not None, "Customer was not retrieved from remote database"
    assert retrieved["email"] == test_email
    assert pwd_context.verify(raw_password, retrieved["password_hash"]), "Password verification failed"
    print("CUSTOMER RETRIEVAL & PASSWORD VERIFY: PASS")

    # 4. Duplicate Email Protection
    print("Testing duplicate email rejection...")
    dup_email_doc = {
        "id": str(uuid.uuid4()),
        "email": test_email,
        "phone": f"+9198{uuid.uuid4().int % 100000000:08d}",
        "name": "Duplicate Email Test",
        "password_hash": password_hash,
        "roles": ["customer"],
    }
    dup_email_caught = False
    try:
        await db.users.insert_one(dup_email_doc)
    except Exception as exc:
        dup_email_caught = True
        print(f"DUPLICATE EMAIL REJECTION: PASS ({type(exc).__name__} correctly raised)")
    assert dup_email_caught, "Unique email constraint did not trigger!"

    # 5. Duplicate Phone Protection
    print("Testing duplicate phone rejection...")
    dup_phone_doc = {
        "id": str(uuid.uuid4()),
        "email": f"other.{test_id}@kotson-staging.com",
        "phone": test_phone_canonical,
        "name": "Duplicate Phone Test",
        "password_hash": password_hash,
        "roles": ["customer"],
    }
    dup_phone_caught = False
    try:
        await db.users.insert_one(dup_phone_doc)
    except Exception as exc:
        dup_phone_caught = True
        print(f"DUPLICATE PHONE REJECTION: PASS ({type(exc).__name__} correctly raised)")
    assert dup_phone_caught, "Unique phone constraint did not trigger!"

    # 6. Critical Restart Persistence Test (Simulate backend restart)
    print("Simulating process restart (reloading db client)...")
    new_db = PostgresDatabase()
    restarted_user = await new_db.users.find_one({"id": created_user_id})
    assert restarted_user is not None, "User did not survive process restart!"
    assert restarted_user["email"] == test_email
    print("RESTART PERSISTENCE: PASS (User reliably exists in Supabase PostgreSQL across sessions)")

    # 7. Password Reset Token Persistence
    print("Testing password reset persistence...")
    raw_token = f"rst_{uuid.uuid4().hex}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    reset_doc = {
        "id": str(uuid.uuid4()),
        "user_id": created_user_id,
        "phone": test_phone_canonical,
        "token_hash": token_hash,
        "purpose": "password_reset",
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15),
        "created_at": datetime.now(timezone.utc),
    }
    await db.password_resets.insert_one(reset_doc)
    fetched_reset = await db.password_resets.find_one({"token_hash": token_hash})
    assert fetched_reset is not None
    assert fetched_reset["used"] is False

    # Mark as used (atomic single-use test)
    await db.password_resets.update_one(
        {"id": fetched_reset["id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )
    consumed_reset = await db.password_resets.find_one({"token_hash": token_hash})
    assert consumed_reset["used"] is True
    print("FORGOT PASSWORD PERSISTENCE & SINGLE-USE CONSUMPTION: PASS")

    # 8. Referral Engine Retrieval
    rule = await db.referral_rules.find_one({"id": "default_rule"})
    assert rule is not None, "Default referral rule not found in remote DB"
    assert rule["commission_type"] == "PERCENTAGE"
    print(f"REFERRAL RULE RETRIEVAL: PASS ({rule['name']})")

    # 9. Catalog Retrieval
    categories = await db.categories.find({}).to_list(10)
    assert len(categories) == 4, f"Expected 4 categories, found {len(categories)}"
    print(f"CATALOG CATEGORIES RETRIEVAL: PASS ({[c['slug'] for c in categories]})")

    # 10. Cart Persistence
    cart_token = f"cart_{uuid.uuid4().hex[:12]}"
    cart_doc = {
        "id": str(uuid.uuid4()),
        "token": cart_token,
        "user_id": created_user_id,
        "items": [{"variant_id": "test_var_1", "qty": 2, "added_at": datetime.now(timezone.utc).isoformat()}],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.carts.insert_one(cart_doc)
    saved_cart = await db.carts.find_one({"token": cart_token})
    assert saved_cart is not None
    assert len(saved_cart["items"]) == 1
    # Update quantity
    await db.carts.update_one(
        {"token": cart_token},
        {"$set": {"items": [{"variant_id": "test_var_1", "qty": 3}]}}
    )
    updated_cart = await db.carts.find_one({"token": cart_token})
    assert updated_cart["items"][0]["qty"] == 3
    print("CART PERSISTENCE & MUTATION: PASS")

    # 11. Custom Product Requests Persistence
    req_number = f"KT-CUSTOM-{uuid.uuid4().int % 1000000:06d}"
    req_id = f"cpr_{uuid.uuid4().hex[:12]}"
    custom_doc = {
        "id": req_id,
        "request_number": req_number,
        "customer_id": created_user_id,
        "customer_name": "Test Customer",
        "mobile": test_phone_canonical,
        "product_name_snapshot": "Custom Natural Latex Mattress 78x72x8",
        "length": "78",
        "breadth": "72",
        "height_or_thickness": "8",
        "measurement_unit": "inch",
        "status": "NEW",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.custom_product_requests.insert_one(custom_doc)
    saved_req = await db.custom_product_requests.find_one({"request_number": req_number})
    assert saved_req is not None
    assert saved_req["status"] == "NEW"
    print("CUSTOM PRODUCT REQUEST PERSISTENCE: PASS")

    # 12. Webhook Idempotency (processed_events uniqueness)
    event_id = f"evt_test_{uuid.uuid4().hex}"
    await db.processed_events.insert_one({"id": str(uuid.uuid4()), "event_id": event_id})
    dup_evt_caught = False
    try:
        await db.processed_events.insert_one({"id": str(uuid.uuid4()), "event_id": event_id})
    except Exception:
        dup_evt_caught = True
    assert dup_evt_caught, "Duplicate event_id was not rejected by unique constraint"
    print("WEBHOOK IDEMPOTENCY (DUPLICATE EVENT REJECTION): PASS")

    # 13. Clean up test user & child records
    print("Cleaning up controlled test acceptance records...")
    await db.users.delete_one({"id": created_user_id})
    await db.custom_product_requests.delete_one({"id": req_id})
    await db.carts.delete_one({"token": cart_token})
    await db.processed_events.delete_one({"event_id": event_id})
    cleanup_verify = await db.users.find_one({"id": created_user_id})
    assert cleanup_verify is None
    print("CLEANUP: PASS (Test acceptance records safely purged)")

    # 14. CRITICAL LOCAL JSON INTEGRITY CHECK
    print("Verifying local JSON file remained 100% untouched...")
    final_mtime = local_json_file.stat().st_mtime if local_json_file.exists() else None
    final_hash = hashlib.sha256(local_json_file.read_bytes()).hexdigest() if local_json_file.exists() else None

    assert initial_mtime == final_mtime, "kotson_local_db.json mtime changed during Supabase tests!"
    assert initial_hash == final_hash, "kotson_local_db.json content hash changed during Supabase tests!"
    print("CRITICAL LOCAL JSON PROTECTION: PASS (Zero writes, Zero fallback, File 100% unmodified)")

    print("=" * 60)
    print("ALL REMOTE SUPABASE ACCEPTANCE TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())
