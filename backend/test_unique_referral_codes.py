import asyncio
import time
import httpx
from lib.db import db
from lib.referral_seed import migrate_user_referral_codes

BASE_URL = "http://127.0.0.1:8001/api"

async def test_unique_codes_suite():
    print("=== STARTING UNIQUE REFERRAL CODES & USER MIGRATION SUITE ===")
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        ts = int(time.time() * 1000)
        
        # 1. Create User A
        email_a = f"usera_{ts}@example.com"
        res_a = await client.post("/auth/signup", json={"name": "User Alpha", "email": email_a, "password": "Password123!"})
        assert res_a.status_code == 200, f"Signup A failed: {res_a.text}"
        code_a = res_a.json()["user"]["referral_code"]
        assert code_a and len(code_a) >= 6, f"Invalid code A: {code_a}"

        # 2. Create User B
        email_b = f"userb_{ts}@example.com"
        res_b = await client.post("/auth/signup", json={"name": "User Beta", "email": email_b, "password": "Password123!"})
        assert res_b.status_code == 200, f"Signup B failed: {res_b.text}"
        code_b = res_b.json()["user"]["referral_code"]
        assert code_b and len(code_b) >= 6, f"Invalid code B: {code_b}"

        # 3. Create User C
        email_c = f"userc_{ts}@example.com"
        res_c = await client.post("/auth/signup", json={"name": "User Gamma", "email": email_c, "password": "Password123!"})
        assert res_c.status_code == 200, f"Signup C failed: {res_c.text}"
        code_c = res_c.json()["user"]["referral_code"]
        assert code_c and len(code_c) >= 6, f"Invalid code C: {code_c}"

        # 4. Assert All Codes are Distinct
        assert code_a != code_b, f"Collision detected! code_a={code_a} == code_b={code_b}"
        assert code_a != code_c, f"Collision detected! code_a={code_a} == code_c={code_c}"
        assert code_b != code_c, f"Collision detected! code_b={code_b} == code_c={code_c}"
        print(f"[PASS] Unique codes created: A={code_a}, B={code_b}, C={code_c}")

        # 5. Stability across logout and login
        await client.post("/auth/logout")
        res_login_a = await client.post("/auth/login", json={"email": email_a, "password": "Password123!"})
        assert res_login_a.status_code == 200
        code_a_relogin = res_login_a.json()["user"]["referral_code"]
        assert code_a_relogin == code_a, f"Code changed on relogin! {code_a} vs {code_a_relogin}"
        print(f"[PASS] Code stability verified on re-login: {code_a_relogin}")

        # 6. Test Migration with Missing Code
        legacy_id = f"legacy_user_{ts}"
        await db.users.insert_one({
            "id": legacy_id,
            "email": f"legacy_{ts}@kotson.test",
            "name": "Legacy Customer",
            "roles": ["customer"],
            "referral_code": None,
            "is_active": True,
            "created_at": "2025-01-01T00:00:00Z"
        })
        
        mig_result = await migrate_user_referral_codes()
        print(f"[PASS] Migration executed: {mig_result}")
        updated_legacy = await db.users.find_one({"id": legacy_id})
        assert updated_legacy.get("referral_code"), "Legacy user was not assigned a referral code"
        print(f"[PASS] Legacy user assigned unique code: {updated_legacy['referral_code']}")

        # 7. Test Migration with Duplicate Codes
        dup1_id = f"dup1_{ts}"
        dup2_id = f"dup2_{ts}"
        clash_code = f"KSCLASH{ts % 1000}"
        await db.users.insert_one({
            "id": dup1_id,
            "email": f"dup1_{ts}@kotson.test",
            "name": "Duplicate User 1",
            "roles": ["customer"],
            "referral_code": clash_code,
            "is_active": True,
            "created_at": "2025-01-01T01:00:00Z"
        })
        await db.users.insert_one({
            "id": dup2_id,
            "email": f"dup2_{ts}@kotson.test",
            "name": "Duplicate User 2",
            "roles": ["customer"],
            "referral_code": clash_code,
            "is_active": True,
            "created_at": "2025-01-01T02:00:00Z"
        })
        
        mig_result2 = await migrate_user_referral_codes()
        print(f"[PASS] Duplicate migration executed: {mig_result2}")
        d1 = await db.users.find_one({"id": dup1_id})
        d2 = await db.users.find_one({"id": dup2_id})
        assert d1["referral_code"] == clash_code, "Earliest user should keep the code"
        assert d2["referral_code"] != clash_code, "Duplicate user should receive fresh unique code"
        assert d2["referral_code"].startswith("KS"), "New code should follow standard prefix"
        print(f"[PASS] Duplicate resolved: d1={d1['referral_code']}, d2={d2['referral_code']}")

        # 8. Verify Customer Portal returns complete data without hardcoded claims
        portal_res = await client.get("/referrals/portal", cookies=res_login_a.cookies)
        assert portal_res.status_code == 200
        portal = portal_res.json()
        assert portal["user"]["referral_code"] == code_a
        assert portal["share_url"].endswith(code_a)
        assert "tax_settings" in portal
        print(f"[PASS] Customer portal payload verified for {code_a}")

    print("\nALL UNIQUE REFERRAL CODE TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_unique_codes_suite())
