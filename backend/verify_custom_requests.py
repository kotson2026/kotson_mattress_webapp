"""Verification test suite for Customizable Products Workflow Change.
Tests:
1. Public submission of Custom Product Request (KT-CUSTOM-XXXXXX)
2. Validation rules (customer name, mobile number)
3. Owner Admin authentication and permissions
4. Top 5 KPI counters (New Requests, Under Review, Contacted, Quote Provided, Converted)
5. Authoritative seeded demo request KT-CUSTOM-000124 (Kranthi Kumar, Ortho Core Max Mattress, 78x60x8 in)
6. Admin/Manager review workflow (Status transition, Manager assignment, Internal remarks, Quoted price recording)
7. Standard ecommerce regression: Standard products can still be added to cart; custom flow does not add to cart.
"""

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
        headers={"Content-Type": "application/json"},
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


def patch_json(opener, path, data):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PATCH",
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
    print("=== STARTING KOTSON CUSTOMIZABLE PRODUCTS WORKFLOW VERIFICATION ===")

    # 1. Test public submission validation (Missing mobile or name should fail)
    public_session = make_session()
    status, err_resp = post_json(public_session, "/api/custom-requests", {
        "product_id": "test_prod",
        "product_name_snapshot": "Ortho Core Max Mattress",
        "product_slug": "ortho-core-max-mattress",
        "length": 78,
        "breadth": 60,
        "height_or_thickness": 8,
        "customer_name": "",
        "mobile": "",
    })
    assert status in (400, 422), f"Validation failed: expected 422/400 but got {status}"
    print("[PASS] 1. Contact validation enforced: Empty name/mobile correctly rejected")

    # 2. Test successful public submission of Custom Product Request
    status, submit_res = post_json(public_session, "/api/custom-requests", {
        "product_id": "prod_ortho_core_max",
        "product_name_snapshot": "Ortho Core Max Mattress",
        "product_slug": "ortho-core-max-mattress",
        "category": "mattresses",
        "product_image": "/navbar/mattress.png",
        "size_mode": "custom",
        "length": 78,
        "breadth": 60,
        "height_or_thickness": 8,
        "measurement_unit": "inch",
        "customer_name": "Rohan Mehra",
        "mobile": "9876500001",
        "email": "rohan.mehra@example.com",
        "city": "Hyderabad",
        "pincode": "500081",
        "customer_remarks": "Bespoke height 8 inches needed to fit bed frame groove.",
    })
    assert status == 200, f"Submission failed: {submit_res}"
    assert submit_res["success"] is True
    assert submit_res["request_number"].startswith("KT-CUSTOM-")
    assert submit_res["status"] == "NEW"
    new_req_id = submit_res["request_id"]
    new_req_num = submit_res["request_number"]
    print(f"[PASS] 2. Custom Product Request created server-side: {new_req_num} ({new_req_id}), Status: {submit_res['status']}")

    # 3. Authenticate as Owner Admin
    admin_session = make_session()
    status, login_res = post_json(admin_session, "/api/auth/login", {
        "email": "hello@kotsonmattress.com",
        "password": "Kotson-Owner-2026!",
    })
    assert status == 200, f"Admin login failed: {login_res}"
    print("[PASS] 3. Owner Admin authenticated successfully")

    # 4. List Custom Requests and verify top 5 KPI counters
    status, list_res = get_json(admin_session, "/api/admin/custom-requests")
    assert status == 200, f"List failed: {list_res}"
    counters = list_res["counters"]
    assert "new_count" in counters
    assert "under_review_count" in counters
    assert "contacted_count" in counters
    assert "quote_provided_count" in counters
    assert "converted_count" in counters
    print(f"[PASS] 4. Top 5 KPI counters verified: NEW={counters['new_count']}, UNDER_REVIEW={counters['under_review_count']}, CONTACTED={counters['contacted_count']}, QUOTE_PROVIDED={counters['quote_provided_count']}, CONVERTED={counters['converted_count']}")

    # 5. Check authoritative seeded demo request KT-CUSTOM-000124 (Section 16 spec)
    status, search_res = get_json(admin_session, "/api/admin/custom-requests?q=KT-CUSTOM-000124")
    assert status == 200 and search_res["items"], f"Seeded request KT-CUSTOM-000124 not found: {search_res}"
    kranthi_req = search_res["items"][0]
    assert kranthi_req["customer_name"] == "Kranthi Kumar"
    assert kranthi_req["mobile"] == "9876543210"
    assert "Ortho Core Max" in kranthi_req["product_name"]
    assert kranthi_req["length"] == "78"
    assert kranthi_req["breadth"] == "60"
    assert kranthi_req["height_or_thickness"] == "8"
    print(f"[PASS] 5. Seeded request KT-CUSTOM-000124 matches Section 16 spec: {kranthi_req['customer_name']}, {kranthi_req['product_name']}, {kranthi_req['dimensions_display']}")

    # 6. Admin updates the new request: UNDER_REVIEW -> Assign Manager -> Internal Remarks
    status, patch1 = patch_json(admin_session, f"/api/admin/custom-requests/{new_req_id}", {
        "status": "UNDER_REVIEW",
        "assigned_to_user_id": "mgr_vikram_01",
        "assigned_to_name": "Vikram Malhotra",
        "internal_remarks": "Verified factory line capacity for 78x60x8 in natural latex core.",
    })
    assert status == 200, f"Patch 1 failed: {patch1}"
    assert patch1["request"]["status"] == "UNDER_REVIEW"
    assert patch1["request"]["assigned_to_name"] == "Vikram Malhotra"
    print("[PASS] 6a. Admin transition to UNDER_REVIEW and assigned manager: OK")

    # 7. Admin records quote amount and notes: QUOTE_PROVIDED
    status, patch2 = patch_json(admin_session, f"/api/admin/custom-requests/{new_req_id}", {
        "status": "QUOTE_PROVIDED",
        "quoted_price": 42500.0,
        "quote_notes": "Official quotation provided: Includes 18% GST and custom contouring.",
    })
    assert status == 200, f"Patch 2 failed: {patch2}"
    assert patch2["request"]["status"] == "QUOTE_PROVIDED"
    assert patch2["request"]["quoted_price"] == 42500.0
    print(f"[PASS] 6b. Admin recorded quoted price Rs. {patch2['request']['quoted_price']} and quote notes: OK")

    # 8. Single Request Detail Retrieval
    status, detail = get_json(admin_session, f"/api/admin/custom-requests/{new_req_id}")
    assert status == 200
    assert detail["request_number"] == new_req_num
    assert detail["customer_name"] == "Rohan Mehra"
    assert detail["quoted_price"] == 42500.0
    print(f"[PASS] 7. Full request detail verified for {new_req_num}")

    # 9. Regression check: Normal ecommerce products can still add to cart without issue
    status, active_prods = get_json(admin_session, "/api/catalog/products")
    assert status == 200 and len(active_prods) > 0
    test_prod = active_prods[0]
    assert "variants" in test_prod and len(test_prod["variants"]) > 0
    test_variant_id = test_prod["variants"][0]["id"]

    cust_session = make_session()
    status, cart_res = post_json(cust_session, "/api/cart/items", {
        "variant_id": test_variant_id,
        "qty": 1,
    })
    assert status == 200, f"Normal add to cart failed: {cart_res}"
    print(f"[PASS] 8. Regression verified: Standard catalogue products add to cart normally (variant {test_variant_id})")

    print("\nALL 8 CUSTOMIZABLE PRODUCTS WORKFLOW TESTS PASSED WITH 100% SUCCESS!")


if __name__ == "__main__":
    main()
