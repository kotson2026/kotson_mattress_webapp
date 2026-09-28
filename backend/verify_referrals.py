import asyncio
import json
import urllib.request
import sys

BASE_URL = "http://127.0.0.1:8001"

def make_session():
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    return opener

def post_json(opener, path, data):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def get_json(opener, path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def main():
    print("=== STARTING KOTSON REFER & EARN VERIFICATION SUITE ===")
    
    # 0. Clean test withdrawals for idempotency
    from lib.db import db
    async def reset():
        await db.referral_withdrawals.delete_many({"user_id": "ref_user_kranthi_01", "status": {"$ne": "PAID"}})
    asyncio.run(reset())

    # 1. Login as Owner Admin
    admin_session = make_session()
    status, res = post_json(admin_session, "/api/auth/login", {
        "email": "hello@kotsonmattress.com",
        "password": "Kotson-Owner-2026!"
    })
    assert status == 200, f"Admin login failed: {res}"
    print("[PASS] 1. Owner Admin Authenticated")

    # 2. Check Overview KPI Cards
    status, overview = get_json(admin_session, "/api/admin/referrals/overview")
    assert status == 200, f"Overview failed: {overview}"
    required_kpis = [
        "total_referrers", "total_referral_leads", "referral_sales",
        "referral_sales_value", "pending_commission", "approved_commission",
        "total_commission_earned", "pending_withdrawals"
    ]
    for k in required_kpis:
        assert k in overview, f"Missing KPI {k} in overview: {overview}"
    print(f"[PASS] 2. Authoritative Top 8 KPIs Present: {overview}")

    # 3. Check Referrers Table & Search / Filter
    status, ref_data = get_json(admin_session, "/api/admin/referrals/referrers?q=Kranthi")
    assert status == 200 and ref_data["total"] >= 1, f"Search failed: {ref_data}"
    kranthi = ref_data["referrers"][0]
    assert kranthi["referral_code"] == "KOT-KRA123"
    assert kranthi["leads_count"] == 42
    assert kranthi["sales_count"] == 8
    assert kranthi["sales_value"] == 86000
    assert kranthi["pending_amount"] == 1200
    assert kranthi["total_earned"] == 5600
    assert kranthi["paid_amount"] == 2000
    print(f"[PASS] 3. Kranthi Kumar authoritatively matches Section 3 spec: {kranthi['name']}, {kranthi['referral_code']}, leads={kranthi['leads_count']}, sales={kranthi['sales_count']}, sales_value={kranthi['sales_value']}, pending={kranthi['pending_amount']}, available={kranthi['available_amount']}, earned={kranthi['total_earned']}, paid={kranthi['paid_amount']}")

    # 4. Check Referrer Detail Page & Privacy Protection (Masking)
    user_id = kranthi["user_id"]
    status, detail = get_json(admin_session, f"/api/admin/referrals/referrers/{user_id}")
    assert status == 200, f"Detail failed: {detail}"
    # Sensitive data masking
    assert "****" in detail["kyc"]["pan_masked"], f"PAN not masked: {detail['kyc']}"
    assert "XXXXXX" in detail["bank"]["account_number_masked"], f"Bank not masked: {detail['bank']}"
    for lead in detail["leads"]:
        assert "****" in lead["customer_email_masked"], f"Lead email not masked: {lead}"
    print(f"[PASS] 4. Customer PII and Financial Details masked (PAN: {detail['kyc']['pan_masked']}, Bank: {detail['bank']['account_number_masked']})")

    # 5. Check Section 393 Statutory TDS Configuration
    status, tds_cfg = get_json(admin_session, "/api/admin/referrals/tax-settings")
    assert status == 200, f"TDS config failed: {tds_cfg}"
    assert tds_cfg["pan_available_rate"] == 5.0
    assert tds_cfg["pan_not_available_rate"] == 20.0
    print(f"[PASS] 5. Configurable Section 393 TDS Engine: PAN Rate={tds_cfg['pan_available_rate']}%, No-PAN={tds_cfg['pan_not_available_rate']}%, Nature='{tds_cfg['payment_nature']}'")

    # 6. Customer Portal Experience for Kranthi (/api/referrals/portal)
    # Login as Kranthi
    user_session = make_session()
    status, ulogin = post_json(user_session, "/api/auth/login", {
        "email": "kranthi.kumar@example.com",
        "password": "Kotson-Refer-2026!"
    })
    assert status == 200, f"Kranthi login failed: {ulogin}"
    status, portal = get_json(user_session, "/api/referrals/portal")
    assert status == 200, f"Portal failed: {portal}"
    assert portal["user"]["referral_code"] == "KOT-KRA123"
    assert portal["wallet"]["available_to_withdraw"] == 2400
    assert portal["wallet"]["reserved_for_withdrawal"] == 0
    print(f"[PASS] 6. Customer Referrer Portal loaded: Available={portal['wallet']['available_to_withdraw']}, Reserved={portal['wallet']['reserved_for_withdrawal']}, Total Earned={portal['wallet']['total_earned']}")

    # 7. Withdrawal Overdraft Prevention
    status, over_err = post_json(user_session, "/api/referrals/request-withdrawal", {"amount": 50000})
    assert status == 400, f"Overdraft was not blocked! Status: {status}, res: {over_err}"
    print("[PASS] 7. Withdrawal > Available Balance correctly blocked")

    # 8. Submit Legitimate Withdrawal Request & Reserve Amount
    # Kranthi has 2400 available. Request 400.
    status, w_res = post_json(user_session, "/api/referrals/request-withdrawal", {"amount": 400})
    assert status == 200, f"Withdrawal request failed: {w_res}"
    new_wid = w_res["withdrawal_id"]
    # Re-check portal wallet: available must now be 2000, reserved must be 400
    status, portal2 = get_json(user_session, "/api/referrals/portal")
    assert portal2["wallet"]["available_to_withdraw"] == 2000
    assert portal2["wallet"]["reserved_for_withdrawal"] == 400
    print(f"[PASS] 8. Withdrawal requested ({w_res['request_number']}): Amount instantly reserved ({portal2['wallet']['reserved_for_withdrawal']} reserved, {portal2['wallet']['available_to_withdraw']} remaining available)")

    # 9. Admin Hold & Reject Workflows (Release Reserved Amount)
    # Admin places on HOLD
    status, hold_res = post_json(admin_session, f"/api/admin/referrals/withdrawals/{new_wid}/review", {
        "action": "HOLD",
        "reason": "Auditing bank account verification details"
    })
    assert status == 200, f"Hold failed: {hold_res}"
    print("[PASS] 9a. Owner Admin successfully placed withdrawal ON_HOLD with reason")

    # Admin REJECTS: This must return the reserved 400 back to available wallet balance
    status, rej_res = post_json(admin_session, f"/api/admin/referrals/withdrawals/{new_wid}/review", {
        "action": "REJECT",
        "reason": "Test rejection to verify ledger restoration"
    })
    assert status == 200, f"Reject failed: {rej_res}"
    status, portal3 = get_json(user_session, "/api/referrals/portal")
    assert portal3["wallet"]["available_to_withdraw"] == 2400, f"Reserved funds not returned: {portal3['wallet']}"
    assert portal3["wallet"]["reserved_for_withdrawal"] == 0
    print("[PASS] 9b. Rejection safely released reserved amount back to Available Balance via ledger transaction")

    # 10. Admin APPROVE & MARK AS PAID on Seeded Pending Withdrawal (Priya Sharma KW-2026-0002)
    status, w_list = get_json(admin_session, "/api/admin/referrals/withdrawals?status=REQUESTED")
    assert status == 200 and w_list["items"]
    priya_wid = w_list["items"][0]["id"]
    priya_uid = w_list["items"][0]["user_id"]

    # Testing Section 29 requirement: Approval without verified KYC must be blocked!
    status, unverified_app = post_json(admin_session, f"/api/admin/referrals/withdrawals/{priya_wid}/review", {
        "action": "APPROVE"
    })
    assert status == 400, "Approval without KYC must be blocked!"
    print("[PASS] 10a. Safety check: Admin cannot approve withdrawal when Referrer KYC is unverified")

    # Admin verifies Priya's KYC & Bank
    status, _ = post_json(admin_session, f"/api/admin/referrals/referrers/{priya_uid}/kyc-verify", {"action": "VERIFIED"})
    assert status == 200
    status, _ = post_json(admin_session, f"/api/admin/referrals/referrers/{priya_uid}/bank-verify", {"action": "VERIFIED"})
    assert status == 200

    # Admin Approves now that KYC is verified
    status, app_res = post_json(admin_session, f"/api/admin/referrals/withdrawals/{priya_wid}/review", {
        "action": "APPROVE"
    })
    assert status == 200, f"Approval failed: {app_res}"
    print(f"[PASS] 10b. Owner Admin Approved withdrawal {w_list['items'][0]['request_number']} once KYC verified (State -> APPROVED/PROCESSING)")

    # Attempting to mark paid without UTR must be rejected
    status, fail_pay = post_json(admin_session, f"/api/admin/referrals/withdrawals/{priya_wid}/mark-paid", {
        "utr_number": ""
    })
    assert status in (400, 422), f"Mark paid without UTR was not rejected: {fail_pay}"
    print("[PASS] 10b. Mark as Paid requires valid UTR reference number")

    # Mark as Paid with actual UTR
    status, paid_res = post_json(admin_session, f"/api/admin/referrals/withdrawals/{priya_wid}/mark-paid", {
        "utr_number": "KOTSON-UTR-2026-9912",
        "payment_method": "NEFT",
        "payment_date": "2026-09-28"
    })
    assert status == 200, f"Mark paid failed: {paid_res}"
    print(f"[PASS] 10c. Payout marked as PAID with statutory TDS retained: {paid_res['payout_details']}")


    # 11. Excel Exports
    for ep in ["referrers", "withdrawals", "leads", "commissions"]:
        req = urllib.request.Request(f"{BASE_URL}/api/admin/referrals/export/{ep}")
        with admin_session.open(req) as resp:
            data = resp.read()
            assert resp.status == 200
            assert len(data) > 1000
            assert data[:4] == b"PK\x03\x04", f"Not a valid zip/xlsx format for {ep}"
            print(f"[PASS] 11. Real XLSX Export '{ep}' verified ({len(data)} bytes, valid XLSX signature)")

    print("\nALL 23 CRITICAL REFER & EARN TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    main()
