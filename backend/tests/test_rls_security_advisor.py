import os
import json
import ssl
import urllib.request
import urllib.error

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

SUPABASE_URL = "https://buodzslvzkungwufdkca.supabase.co"

# Load keys from backend/.env
ANON_KEY = None
SERVICE_ROLE_KEY = None
with open("backend/.env", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("SUPABASE_ANON_KEY="):
            ANON_KEY = line.split("=", 1)[1].strip("\"'")
        elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            SERVICE_ROLE_KEY = line.split("=", 1)[1].strip("\"'")

def rest_req(path, method="GET", body=None, token=None, prefer="return=representation"):
    if token is None:
        token = ANON_KEY
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_msg)
        except Exception:
            return e.code, err_msg
    except Exception as e:
        return 0, str(e)

def run_tests():
    print("=" * 60)
    print("1. POSTGREST NEGATIVE SECURITY TESTS (ANON / UNPRIVILEGED)")
    print("=" * 60)
    
    # 1. password_resets SELECT -> Must return []
    code, res = rest_req("password_resets")
    print(f"password_resets SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on password_resets: {res}"

    # 2. password_resets INSERT -> Must be blocked (401/403/RLS violation)
    code, res = rest_req("password_resets", method="POST", body={"phone": "9999999999", "token_hash": "hacked"})
    print(f"password_resets INSERT: status={code}, result={res}")
    assert code in (401, 403, 404, 400) or (code == 201 and res == []), f"Anon inserted into password_resets! {res}"

    # 3. payments SELECT -> Must return []
    code, res = rest_req("payments")
    print(f"payments SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on payments: {res}"

    # 4. payments INSERT -> Must be blocked
    code, res = rest_req("payments", method="POST", body={"order_number": "FAKE-001", "amount_paise": 100})
    print(f"payments INSERT: status={code}, result={res}")
    assert code in (401, 403, 404, 400), f"Anon inserted into payments! {res}"

    # 5. payroll_records SELECT -> Must return []
    code, res = rest_req("payroll_records")
    print(f"payroll_records SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on payroll_records: {res}"

    # 6. inventory_ledger SELECT -> Must return []
    code, res = rest_req("inventory_ledger")
    print(f"inventory_ledger SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on inventory_ledger: {res}"

    # 7. inventory_ledger INSERT -> Must be blocked
    code, res = rest_req("inventory_ledger", method="POST", body={"delta": 100, "reason": "hack"})
    print(f"inventory_ledger INSERT: status={code}, result={res}")
    assert code in (401, 403, 404, 400), f"Anon inserted into inventory_ledger! {res}"

    # 8. crm_calls SELECT -> Must return []
    code, res = rest_req("crm_calls")
    print(f"crm_calls SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on crm_calls: {res}"

    # 9. return_requests SELECT -> Must return []
    code, res = rest_req("return_requests")
    print(f"return_requests SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on return_requests: {res}"

    # 10. dealer_orders SELECT -> Must return []
    code, res = rest_req("dealer_orders")
    print(f"dealer_orders SELECT: status={code}, result={res}")
    assert code == 200 and res == [], f"Security violation on dealer_orders: {res}"

    print("\n" + "=" * 60)
    print("2. POSTGREST POSITIVE STOREFRONT TESTS (ANON)")
    print("=" * 60)

    # 1. products SELECT (must succeed and return active catalog)
    code, res = rest_req("products?select=id,name,slug&is_active=eq.true")
    print(f"products active count: status={code}, count={len(res) if isinstance(res, list) else res}")
    assert code == 200 and isinstance(res, list) and len(res) == 18, f"Unexpected products count: {len(res)}"

    # 2. assets SELECT (must succeed)
    code, res = rest_req("assets?select=id,title,url&limit=5")
    print(f"assets count: status={code}, count={len(res) if isinstance(res, list) else res}")
    assert code == 200 and isinstance(res, list), f"Assets read failed: {res}"

    # 3. custom_product_dimension_config SELECT (must succeed)
    code, res = rest_req("custom_product_dimension_config")
    print(f"custom_product_dimension_config: status={code}, count={len(res) if isinstance(res, list) else res}")
    assert code == 200 and isinstance(res, list), f"Dimension config failed: {res}"

    # 4. settings SELECT (must succeed)
    code, res = rest_req("settings")
    print(f"settings: status={code}, count={len(res) if isinstance(res, list) else res}")
    assert code == 200 and isinstance(res, list), f"Settings read failed: {res}"

    # 5. referral_clicks INSERT (anon click tracking must succeed with return=minimal)
    code, res = rest_req("referral_clicks", method="POST", body={"code": "KOTSON-TEST-REF", "path": "/products/ortho-therapy"}, prefer="return=minimal")
    print(f"referral_clicks INSERT: status={code}, result={res}")
    assert code in (200, 201, 204), f"Referral click insert failed: {res}"

    # 6. referral_clicks SELECT (anon should NOT be able to read back clicks)
    code, res = rest_req("referral_clicks")
    print(f"referral_clicks SELECT (anon): status={code}, count={len(res) if isinstance(res, list) else res}")
    assert code == 200 and res == [], f"Anon was able to read referral_clicks! {res}"

    print("\n" + "=" * 60)
    print("3. CRITICAL EDGE FUNCTION & RPC REGRESSION TESTS")
    print("=" * 60)

    # Test auth-login edge function
    login_url = f"{SUPABASE_URL}/functions/v1/auth-login"
    login_req = urllib.request.Request(
        login_url,
        data=json.dumps({"identifier": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"}).encode("utf-8"),
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(login_req, timeout=15, context=ctx) as r:
            login_res = json.loads(r.read().decode("utf-8"))
            print(f"auth-login Edge Function: status={r.status}, ok={login_res.get('ok')}, user={login_res.get('user', {}).get('email')}", flush=True)
            assert r.status == 200 and login_res.get("ok") is True, f"Login failed: {login_res}"
            user_jwt = login_res.get("session", {}).get("access_token")
    except urllib.error.HTTPError as e:
        print(f"auth-login HTTPError: code={e.code}, body={e.read().decode('utf-8')}", flush=True)
        raise

    # Test authenticated user can read their own user record
    code, own_user = rest_req(f"users?email=eq.hello@kotsonmattress.com", token=user_jwt)
    print(f"authenticated user SELECT own profile: status={code}, records={len(own_user)}", flush=True)
    assert code == 200 and len(own_user) == 1, f"Own profile read failed: {own_user}"

    # Test cart Edge Function (commerce-cart?action=init)
    cart_url = f"{SUPABASE_URL}/functions/v1/commerce-cart?action=init"
    cart_req = urllib.request.Request(
        cart_url,
        data=json.dumps({}).encode("utf-8"),
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}", "Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(cart_req, timeout=15, context=ctx) as r:
        cart_res = json.loads(r.read().decode("utf-8"))
        print(f"commerce-cart init: status={r.status}, ok={cart_res.get('ok')}, data={cart_res.get('data')}", flush=True)
        assert r.status == 200 and cart_res.get("ok") is True, f"Cart function failed: {cart_res}"

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
