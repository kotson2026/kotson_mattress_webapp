import hashlib
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import httpx
from lib.db import db
from lib.security import hash_password, now_utc, verify_password

API_URL = "http://127.0.0.1:8001/api"


@pytest.mark.anyio
async def test_forgot_password_invalid_phone_format():
    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        res = await client.post(
            "/auth/forgot-password/verify",
            json={
                "phone": "12345",
                "msg91_verification_token": "some-valid-token-string-12345",
            },
        )
        assert res.status_code == 422


@pytest.mark.anyio
async def test_forgot_password_req_id_substitution_attack():
    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        fake_req_id = "366943693564333034303733"
        res = await client.post(
            "/auth/forgot-password/verify",
            json={
                "phone": "9876543210",
                "msg91_verification_token": fake_req_id,
                "msg91_request_id": fake_req_id,
            },
        )
        # Must be rejected because reqId cannot be used as verification access token
        assert res.status_code == 403
        assert "Request ID cannot be used as verification evidence" in res.json().get("detail", "")


@pytest.mark.anyio
async def test_forgot_password_non_existent_phone():
    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        # 9999999999 does not exist
        res = await client.post(
            "/auth/forgot-password/verify",
            json={
                "phone": "9999999999",
                "msg91_verification_token": "test_mock_token_sample_test_9999999999",
            },
        )
        assert res.status_code == 404
        assert "No customer account is registered" in res.json().get("detail", "")


@pytest.mark.anyio
async def test_forgot_password_staff_account_rejected():
    # Create or ensure a staff user exists
    staff_phone = "+919876500001"
    staff_user = await db.users.find_one({"phone": staff_phone})
    if not staff_user:
        staff_user = {
            "id": str(uuid.uuid4()),
            "email": "test_staff_recovery@kotsonmattress.com",
            "name": "Test Staff",
            "phone": staff_phone,
            "password_hash": hash_password("OldStaffPass123!"),
            "roles": ["manager"],
            "is_active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(staff_user)
    else:
        await db.users.update_one({"id": staff_user["id"]}, {"$set": {"roles": ["manager"]}})

    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        res = await client.post(
            "/auth/forgot-password/verify",
            json={
                "phone": "9876500001",
                "msg91_verification_token": "test_mock_token_for_staff_test",
            },
        )
        assert res.status_code == 403
        assert "Staff and administrative accounts cannot reset passwords" in res.json().get("detail", "")


@pytest.mark.anyio
async def test_forgot_password_full_success_flow():
    # 1. Create a dedicated customer user with known credentials and referral link
    customer_phone = "+919876500002"
    raw_phone_10 = "9876500002"
    original_pass = "OriginalPass2026!"
    ref_code = "KSTESTREF1"

    existing = await db.users.find_one({"phone": customer_phone})
    if existing:
        await db.users.delete_one({"id": existing["id"]})

    user_id = str(uuid.uuid4())
    customer = {
        "id": user_id,
        "email": f"cust_{user_id[:8]}@example.com",
        "name": "Test Recovery Customer",
        "phone": customer_phone,
        "password_hash": hash_password(original_pass),
        "roles": ["customer"],
        "referral_code": ref_code,
        "referred_by": "KSREFERRER99",
        "is_active": True,
        "created_at": now_utc(),
    }
    await db.users.insert_one(customer)

    count_before = await db.users.count_documents({"phone": customer_phone})
    assert count_before == 1

    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        # 2. Step 1: Verify phone and receive reset_token
        verify_res = await client.post(
            "/auth/forgot-password/verify",
            json={
                "phone": raw_phone_10,
                "msg91_verification_token": f"test_mock_token_{user_id}",
            },
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["ok"] is True
        reset_token = verify_data["reset_token"]
        assert len(reset_token) >= 20

        # Verify token is hashed in DB, never plaintext
        token_hash = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
        reset_doc = await db.password_resets.find_one({"token_hash": token_hash})
        assert reset_doc is not None
        assert reset_doc["user_id"] == user_id
        assert reset_doc["used"] is False

        # 3. Test validation errors on reset:
        # A. Password mismatch
        bad_match = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": reset_token,
                "new_password": "NewSecretPass2026!",
                "confirm_password": "DifferentPass2026!",
            },
        )
        assert bad_match.status_code == 422

        # B. Password too short (<8)
        short_pass = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": reset_token,
                "new_password": "short",
                "confirm_password": "short",
            },
        )
        assert short_pass.status_code == 422

        # C. Invalid reset token
        fake_token = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": "completely_bogus_token_1234567890",
                "new_password": "NewSecretPass2026!",
                "confirm_password": "NewSecretPass2026!",
            },
        )
        assert fake_token.status_code == 400

        # 4. Valid Password Reset
        new_pass = "NewBrandNewPass2026!"
        reset_res = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": reset_token,
                "new_password": new_pass,
                "confirm_password": new_pass,
            },
        )
        assert reset_res.status_code == 200
        assert reset_res.json()["ok"] is True

        # 5. Reset authorization cannot be reused (Single-Use Protection)
        reuse_res = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": reset_token,
                "new_password": "AnotherNewPass2026!",
                "confirm_password": "AnotherNewPass2026!",
            },
        )
        assert reuse_res.status_code == 400
        assert "already been used" in reuse_res.json().get("detail", "")

        # 6. Verify Customer Record Invariants:
        updated_customer = await db.users.find_one({"id": user_id})
        assert updated_customer is not None
        # Referral attribution remains completely unchanged
        assert updated_customer["referral_code"] == ref_code
        assert updated_customer["referred_by"] == "KSREFERRER99"
        # No duplicate customer created
        count_after = await db.users.count_documents({"phone": customer_phone})
        assert count_after == 1

        # 7. Old password no longer authenticates
        old_login = await client.post(
            "/auth/login",
            json={
                "identifier": customer_phone,
                "password": original_pass,
            },
        )
        assert old_login.status_code == 401

        # 8. New password authenticates successfully
        new_login = await client.post(
            "/auth/login",
            json={
                "identifier": customer_phone,
                "password": new_pass,
            },
        )
        assert new_login.status_code == 200
        auth_data = new_login.json()
        assert auth_data["user"]["id"] == user_id
        assert auth_data["user"]["phone"] == customer_phone


@pytest.mark.anyio
async def test_forgot_password_expired_token():
    user_id = str(uuid.uuid4())
    raw_token = "expired_token_test_1234567890"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expired_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "phone": "+919876500003",
        "token_hash": token_hash,
        "purpose": "password_reset",
        "used": False,
        "created_at": now_utc() - timedelta(minutes=20),
        "expires_at": now_utc() - timedelta(minutes=10),
    }
    await db.password_resets.insert_one(expired_doc)

    async with httpx.AsyncClient(base_url=API_URL, timeout=10.0) as client:
        res = await client.post(
            "/auth/forgot-password/reset",
            json={
                "reset_token": raw_token,
                "new_password": "ValidNewPassword2026!",
                "confirm_password": "ValidNewPassword2026!",
            },
        )
        assert res.status_code == 400
        assert "expired" in res.json().get("detail", "")
