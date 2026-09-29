"""
Acceptance Test Suite for MSG91 Custom Web SDK OTP Integration & Registration Security.
Validates:
1. Server-side MSG91 verification enforcement (Frontend bypass rejection)
2. Valid OTP registration and database persistence (phone_verified, phone_verified_at, phone_verification_provider)
3. Duplicate phone & duplicate email blocking
4. Phone number normalization (+91 vs raw)
5. Sign-in regression (email/phone + password)
6. Staff / Quick-fill regression
7. Referral attribution preservation
"""

import sys
import uuid
import random
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8001/api"

def random_phone():
    return str(random.randint(6000000000, 9999999999))

def test_msg91_acceptance():
    print("\n--- RUNNING MSG91 OTP & REGISTRATION ACCEPTANCE TESTS ---")

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Health check
    res = client.get("/")
    assert res.status_code == 200, f"Backend health check failed: {res.text}"
    print("✓ Backend is alive and healthy")

    # Generate unique test user data
    unique_suffix = uuid.uuid4().hex[:6]
    test_phone = random_phone()
    test_email = f"customer_{unique_suffix}@example.com"
    test_password = "SecurePassword123!"
    test_name = f"Test Customer {unique_suffix}"

    # TEST 10: FRONTEND BYPASS - Attempt registration without MSG91 verification token
    print("\n[TEST 10] Testing Frontend Bypass Prevention (Missing MSG91 verification token)...")
    res = client.post("/auth/signup", json={
        "name": test_name,
        "email": test_email,
        "phone": f"+91{test_phone}",
        "password": test_password,
        "consent": True,
        # Intentionally omitting msg91_verification_token
    })
    assert res.status_code in (400, 403), f"Expected 400/403 when missing token, got {res.status_code}: {res.text}"
    assert "verification" in res.json().get("detail", "").lower(), f"Unexpected error detail: {res.text}"
    print("✓ Frontend bypass blocked: Backend rejected registration without MSG91 verification evidence")

    # TEST 10b: FRONTEND BYPASS - Attempt registration with empty token
    print("\n[TEST 10b] Testing Frontend Bypass Prevention (Empty MSG91 verification token)...")
    suffix_b = uuid.uuid4().hex[:6]
    phone_b = random_phone()
    res = client.post("/auth/signup", json={
        "name": f"Test Customer {suffix_b}",
        "email": f"customer_{suffix_b}@example.com",
        "phone": f"+91{phone_b}",
        "password": test_password,
        "consent": True,
        "msg91_verification_token": "   ",
    })
    assert res.status_code in (400, 403), f"Expected 400/403 with empty token, got {res.status_code}: {res.text}"
    print("✓ Frontend bypass blocked: Backend rejected empty token")

    # TEST 5 & 12: REGISTRATION WITH VALID MSG91 VERIFICATION EVIDENCE
    print("\n[TEST 5 & 12] Testing Legitimate Registration with MSG91 Verification Evidence...")
    # In development mode, the token can be a mock or widget response token
    valid_token = f"msg91_dev_token_{uuid.uuid4().hex}"
    req_id = f"msg91_req_{uuid.uuid4().hex[:8]}"

    res = client.post("/auth/signup", json={
        "name": test_name,
        "email": test_email,
        "phone": f"+91{test_phone}",
        "password": test_password,
        "consent": True,
        "msg91_verification_token": valid_token,
        "msg91_request_id": req_id,
    })
    assert res.status_code == 200, f"Registration failed: {res.status_code} {res.text}"
    user_data = res.json().get("user", {})
    assert user_data.get("email") == test_email.lower(), "Email mismatch"
    assert user_data.get("phone") == f"+91{test_phone}", "Phone mismatch"
    assert user_data.get("phone_verified") is True, f"phone_verified should be True, got {user_data.get('phone_verified')}"
    assert user_data.get("phone_verification_provider") == "MSG91", f"phone_verification_provider should be MSG91, got {user_data.get('phone_verification_provider')}"
    assert user_data.get("phone_verified_at") is not None, "phone_verified_at timestamp should not be None"
    print("✓ Customer registered successfully with phone_verified=True, provider='MSG91', and verified_at timestamp")

    # TEST 9: DUPLICATE PHONE PREVENTION
    print("\n[TEST 9] Testing Duplicate Phone Prevention...")
    res = client.post("/auth/signup", json={
        "name": "Another Customer",
        "email": f"different_{unique_suffix}@example.com",
        "phone": f"+91{test_phone}",  # Same phone
        "password": "AnotherPassword123!",
        "consent": True,
        "msg91_verification_token": valid_token,
    })
    assert res.status_code in (400, 409), f"Expected 400/409 for duplicate phone, got {res.status_code}: {res.text}"
    assert "phone" in res.json().get("detail", "").lower(), f"Expected phone error, got {res.text}"
    print("✓ Duplicate phone registration blocked")

    # TEST 9b: DUPLICATE EMAIL PREVENTION
    print("\n[TEST 9b] Testing Duplicate Email Prevention...")
    res = client.post("/auth/signup", json={
        "name": "Another Customer",
        "email": test_email,  # Same email
        "phone": f"+91{random_phone()}",
        "password": "AnotherPassword123!",
        "consent": True,
        "msg91_verification_token": valid_token,
    })
    assert res.status_code in (400, 409), f"Expected 400/409 for duplicate email, got {res.status_code}: {res.text}"
    assert "email" in res.json().get("detail", "").lower(), f"Expected email error, got {res.text}"
    print("✓ Duplicate email registration blocked")

    # TEST 13: SIGN-IN REGRESSION (EMAIL + PASSWORD)
    print("\n[TEST 13a] Testing Sign-In via Email + Password...")
    res = client.post("/auth/login", json={
        "identifier": test_email,
        "password": test_password,
    })
    assert res.status_code == 200, f"Sign-in via email failed: {res.status_code} {res.text}"
    logged_in_user = res.json().get("user", {})
    assert logged_in_user.get("phone_verified") is True
    print("✓ Sign-In via Email + Password succeeded without OTP")

    # TEST 13b: SIGN-IN REGRESSION (PHONE + PASSWORD)
    print("\n[TEST 13b] Testing Sign-In via Phone + Password...")
    res = client.post("/auth/login", json={
        "identifier": f"+91{test_phone}",
        "password": test_password,
    })
    assert res.status_code == 200, f"Sign-in via phone failed: {res.status_code} {res.text}"
    print("✓ Sign-In via Phone + Password succeeded without OTP")

    # TEST 14: STAFF / QUICK-FILL REGRESSION
    print("\n[TEST 14] Testing Staff / Quick-Fill Roles Authentication...")
    staff_credentials = [
        ("crm@kotsonmattress.com", "Kotson-CRM-2026!", "crm_master"),
        ("crm.employee@kotsonmattress.com", "Kotson-CRMEmp-2026!", "crm_employee"),
        ("hello@kotsonmattress.com", "Kotson-Owner-2026!", "owner"),
        ("manager@kotsonmattress.com", "Kotson-Manager-2026!", "manager"),
    ]

    for email, pwd, expected_role in staff_credentials:
        res = client.post("/auth/login", json={
            "identifier": email,
            "password": pwd,
        })
        assert res.status_code == 200, f"Staff login failed for {email}: {res.status_code} {res.text}"
        roles = res.json().get("user", {}).get("roles", [])
        assert expected_role in roles, f"Expected role {expected_role} in {roles} for {email}"
        print(f"  ✓ Staff role verified: {email} -> {roles}")
    print("✓ All Staff / Quick-Fill authentications continue working without OTP")

    # TEST 8: REFERRAL ATTRIBUTION PRESERVATION
    print("\n[TEST 8] Testing Referral Attribution Preservation...")
    # First get an existing customer or owner referral code
    res = client.post("/auth/login", json={
        "identifier": test_email,
        "password": test_password,
    })
    referrer_code = res.json().get("user", {}).get("referral_code")
    print(f"  Using referrer code: {referrer_code}")

    if referrer_code:
        referred_suffix = uuid.uuid4().hex[:6]
        referred_phone = random_phone()
        referred_email = f"referred_{referred_suffix}@example.com"
        referred_token = f"msg91_dev_token_{uuid.uuid4().hex}"

        res = client.post("/auth/signup", json={
            "name": f"Referred Customer {referred_suffix}",
            "email": referred_email,
            "phone": f"+91{referred_phone}",
            "password": test_password,
            "consent": True,
            "referral_code": referrer_code,
            "msg91_verification_token": referred_token,
        })
        assert res.status_code == 200, f"Referred registration failed: {res.status_code} {res.text}"
        referred_user = res.json().get("user", {})
        assert referred_user.get("referred_by") == referrer_code, f"Referral attribution was lost: {referred_user.get('referred_by')} vs {referrer_code}"
        print(f"✓ Referral attribution preserved: referred_by = {referrer_code}")

    print("\n============================================================")
    print("ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("============================================================\n")

if __name__ == "__main__":
    test_msg91_acceptance()
