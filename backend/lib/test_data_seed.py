"""Kotson Default Test Data / Development Seed Engine.

Enforces:
- Deterministic, repeatable, and idempotent seed generation.
- Full tagging: `is_test_data: True`, `data_environment: "SEED"`, `seed_batch_id: "KOTSON_DEV_SEED_V1"`, `seed_key: "<key>"`.
- Non-destructive: Uses real existing products and catalog master data without duplication.
- Safe dependency-ordered cleanup (`remove_kotson_test_data`).
- Full coverage of categories, inventory states, orders, CRM, dealers, carts, referrals, shipments, and audit trails.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from lib.security import hash_password

SEED_BATCH_ID = "KOTSON_DEV_SEED_V1"
P = 100  # Rupees to paise conversion


def get_dates():
    now = datetime.now(timezone.utc)
    return {
        "today": now,
        "yesterday": now - timedelta(days=1),
        "days_3_ago": now - timedelta(days=3),
        "week_ago": now - timedelta(days=7),
        "days_12_ago": now - timedelta(days=12),
        "days_20_ago": now - timedelta(days=20),
        "last_month": now - timedelta(days=35),
        "two_months_ago": now - timedelta(days=65),
    }


async def get_test_data_status(db) -> Dict[str, Any]:
    batch = await db.seed_batches.find_one({"batch_id": SEED_BATCH_ID})
    is_seeded = bool(batch)

    counts = {
        "customers": await db.users.count_documents({"seed_batch_id": SEED_BATCH_ID, "roles": "customer"}),
        "staff": await db.users.count_documents({"seed_batch_id": SEED_BATCH_ID, "roles": {"$ne": "customer"}}),
        "orders": await db.orders.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "dealers": await db.dealers.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "dealer_orders": await db.dealer_orders.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "carts": await db.carts.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "leads": await db.leads.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "pipelines": await db.pipelines.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "campaigns": await db.campaigns.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "shipments": await db.shipments.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "returns": await db.return_requests.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "inventory_adjustments": await db.inventory_ledger.count_documents({"seed_batch_id": SEED_BATCH_ID}),
        "audit_entries": await db.audit_log.count_documents({"seed_batch_id": SEED_BATCH_ID}),
    }

    return {
        "is_seeded": is_seeded,
        "batch_id": SEED_BATCH_ID,
        "seeded_at": batch.get("created_at").isoformat() if batch and batch.get("created_at") else None,
        "counts": counts,
    }


async def seed_kotson_test_data(db, force: bool = False) -> Dict[str, Any]:
    """Idempotently seeds comprehensive development test data for Kotson."""
    existing = await db.seed_batches.find_one({"batch_id": SEED_BATCH_ID})
    if existing and not force:
        return await get_test_data_status(db)

    # Clean up prior partial or existing seed batch to guarantee clean idempotent insertion
    await remove_kotson_test_data(db)

    d = get_dates()

    # -----------------------------------------------------------------------------
    # 1. TEST USERS (Customers, Staff, Managers)
    # -----------------------------------------------------------------------------
    test_customers_spec = [
        ("customer_001", "Ravi Kumar", "ravi.test@example.com", "+919999900001", "Hyderabad", "Telangana", "500001", d["days_3_ago"], "KSRAVI01"),
        ("customer_002", "Suresh Reddy", "suresh.test@example.com", "+919999900002", "Warangal", "Telangana", "506002", d["days_20_ago"], "KSSURE02"),
        ("customer_003", "Anil Kumar", "anil.test@example.com", "+919999900003", "Vijayawada", "Andhra Pradesh", "520001", d["week_ago"], "KSANIL03"),
        ("customer_004", "Priya Sharma", "priya.test@example.com", "+919999900004", "Visakhapatnam", "Andhra Pradesh", "530001", d["yesterday"], "KSPRIY04"),
        ("customer_005", "Rahul Verma", "rahul.test@example.com", "+919999900005", "Tirupati", "Andhra Pradesh", "517501", d["last_month"], "KSRAHU05"),
        ("customer_006", "Deepa Nair", "deepa.test@example.com", "+919999900006", "Hyderabad", "Telangana", "500081", d["today"], "KSDEEP06"),
        ("customer_007", "Karthik Raja", "karthik.test@example.com", "+919999900007", "Karimnagar", "Telangana", "505001", d["days_12_ago"], "KSKART07"),
        ("customer_008", "Sneha Rao", "sneha.test@example.com", "+919999900008", "Guntur", "Andhra Pradesh", "522002", d["days_20_ago"], "KSSNEH08"),
    ]

    cust_map = {}
    for key, name, email, phone, city, state, pincode, signup_date, ref_code in test_customers_spec:
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "name": f"{name} [TEST]",
            "email": email,
            "phone": phone,
            "password_hash": hash_password("Kotson-Test-2026!"),
            "roles": ["customer"],
            "referral_code": ref_code,
            "referred_by": None,
            "address": {"full_name": name, "phone": phone, "line1": "Test Resident St", "city": city, "state": state, "pincode": pincode},
            "is_active": True,
            "created_at": signup_date,
            "updated_at": signup_date,
        }
        await db.users.insert_one(doc)
        cust_map[key] = doc

    # Test Employees & Managers
    test_staff_spec = [
        ("emp_001", "Sales Executive 01 [TEST]", "sales01.test@kotsonmattress.com", "+919999910001", ["employee", "crm_employee"]),
        ("emp_002", "Sales Executive 02 [TEST]", "sales02.test@kotsonmattress.com", "+919999910002", ["employee", "crm_employee"]),
        ("emp_003", "Sales Executive 03 [TEST]", "sales03.test@kotsonmattress.com", "+919999910003", ["employee", "crm_employee"]),
        ("emp_004", "Store Executive 01 [TEST]", "store01.test@kotsonmattress.com", "+919999910004", ["employee"]),
        ("emp_005", "Dealer Sales Exec 01 [TEST]", "dealer01.test@kotsonmattress.com", "+919999910005", ["employee"]),
        ("mgr_001", "Retail Sales Manager [TEST]", "retailmgr.test@kotsonmattress.com", "+919999910010", ["manager", "crm_manager"]),
        ("mgr_002", "Dealer Sales Manager [TEST]", "dealermgr.test@kotsonmattress.com", "+919999910011", ["manager"]),
    ]

    staff_map = {}
    for key, name, email, phone, roles in test_staff_spec:
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "name": name,
            "email": email,
            "phone": phone,
            "password_hash": hash_password("Kotson-Staff-2026!"),
            "roles": roles,
            "is_active": True,
            "created_at": d["last_month"],
        }
        await db.users.insert_one(doc)
        staff_map[key] = doc

    # -----------------------------------------------------------------------------
    # 2. PRODUCT MASTER INVENTORY TIERS & ADJUSTMENTS
    # -----------------------------------------------------------------------------
    products = await db.products.find({}).to_list(100)
    variants = await db.variants.find({}).to_list(500)

    # Configure inventory variations on existing variants to guarantee test tiers:
    # 25 (Normal), 5 (Low Stock), 4 (Low Stock), 2 (Critical), 1 (Critical), 0 (Out of Stock)
    stock_targets = [
        (0, 25, 2),   # variant 0: Normal stock (25 total, 2 reserved -> 23 free)
        (1, 5, 0),    # variant 1: Low stock (5 total, 0 reserved -> 5 free)
        (2, 4, 0),    # variant 2: Low stock (4 total, 0 reserved -> 4 free)
        (3, 2, 0),    # variant 3: Critical stock (2 total, 0 reserved -> 2 free)
        (4, 1, 0),    # variant 4: Critical stock (1 total, 0 reserved -> 1 free)
        (5, 0, 0),    # variant 5: Out of stock (0 total, 0 reserved -> 0 free)
    ]

    for idx, (var_idx, stock_val, res_val) in enumerate(stock_targets):
        if var_idx < len(variants):
            v = variants[var_idx]
            # Save original baseline for clean restoration
            await db.variants.update_one(
                {"id": v["id"]},
                {"$set": {
                    "stock": stock_val,
                    "reserved": res_val,
                    "free_stock": stock_val - res_val,
                    "is_seed_adjusted": True,
                    "seed_batch_id": SEED_BATCH_ID,
                }}
            )

    # 5 Inventory Adjustments in Ledger
    adj_reasons = [
        ("Stock Received", 10, 15, 25, d["week_ago"]),
        ("Manual Correction", 2, 3, 5, d["days_3_ago"]),
        ("Return Restocked", 1, 3, 4, d["days_12_ago"]),
        ("Damaged Stock", -2, 4, 2, d["yesterday"]),
        ("Inventory Reconciliation", -1, 2, 1, d["today"]),
    ]

    for i, (reason, delta, old_s, new_s, adj_date) in enumerate(adj_reasons):
        var_sample = variants[i % len(variants)] if variants else {}
        await db.inventory_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": f"adj_{i+1}",
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "variant_id": var_sample.get("id"),
            "sku": var_sample.get("sku"),
            "delta": delta,
            "old_stock": old_s,
            "new_stock": new_s,
            "reason": f"{reason} [TEST]",
            "actor_id": staff_map["emp_001"]["id"],
            "actor_email": staff_map["emp_001"]["email"],
            "created_at": adj_date,
        })

    # Group variants by category
    prod_map = {p["id"]: p for p in products}
    cat_variants: Dict[str, List[Any]] = {"mattresses": [], "pillows": [], "toppers": [], "baby-kids": []}
    for v in variants:
        p = prod_map.get(v.get("product_id"))
        if p:
            cslug = p.get("category_slug", "mattresses").lower()
            if cslug in cat_variants:
                cat_variants[cslug].append({"variant": v, "product": p})

    # -----------------------------------------------------------------------------
    # 3. DEALERS (5 Approved, 5 Pending Applications)
    # -----------------------------------------------------------------------------
    dealer_specs = [
        ("dealer_001", "Hyderabad Sleep World [TEST]", "36AABCS1429B1Z1", "Hyderabad Central", "approved", "+919999920001", d["last_month"]),
        ("dealer_002", "Telangana Mattress Hub [TEST]", "36AACCT9876C1Z2", "Warangal City", "approved", "+919999920002", d["days_20_ago"]),
        ("dealer_003", "Andhra Latex Comforts [TEST]", "37AAACR1234D1Z3", "Vijayawada West", "approved", "+919999920003", d["days_12_ago"]),
        ("dealer_004", "Vizag Royal Furnishings [TEST]", "37AABCF5678E1Z4", "Visakhapatnam Harbor", "approved", "+919999920004", d["week_ago"]),
        ("dealer_005", "Tirupati Bedding Mart [TEST]", "37AADCT4321F1Z5", "Tirupati Temple Rd", "approved", "+919999920005", d["days_3_ago"]),
        ("dealer_006", "Secunderabad Natural Foam [TEST]", "36AABCS9988G1Z6", "Secunderabad Cantonment", "pending", "+919999920006", d["yesterday"]),
        ("dealer_007", "Karimnagar Sleep Gallery [TEST]", "36AACCT5544H1Z7", "Karimnagar Main Road", "pending", "+919999920007", d["days_3_ago"]),
        ("dealer_008", "Guntur Organic Living [TEST]", "37AAACR7766I1Z8", "Guntur Market", "pending", "+919999920008", d["week_ago"]),
        ("dealer_009", "Nellore Home Comfort [TEST]", "37AABCF3322J1Z9", "Nellore Bypass", "pending", "+919999920009", d["today"]),
        ("dealer_010", "Khammam Furniture House [TEST]", "36AADCT1122K1Z0", "Khammam Trunk Rd", "pending", "+919999920010", d["yesterday"]),
    ]

    dealer_map = {}
    for key, org, gstin, territory, status, phone, app_date in dealer_specs:
        uid = str(uuid.uuid4())
        user_doc = {
            "id": uid,
            "seed_key": f"user_{key}",
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "name": f"{org} (Contact)",
            "email": f"{key}@dealers.kotson.test",
            "phone": phone,
            "password_hash": hash_password("Kotson-Dealer-2026!"),
            "roles": ["customer"],
            "is_active": True,
            "created_at": app_date,
        }
        await db.users.insert_one(user_doc)

        dealer_id = str(uuid.uuid4())
        doc = {
            "id": dealer_id,
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "user_id": uid,
            "org_name": org,
            "gstin": gstin,
            "territory": territory,
            "phone": phone,
            "status": status,
            "terms_status": "accepted",
            "created_at": app_date,
        }
        await db.dealers.insert_one(doc)
        dealer_map[key] = doc

    # -----------------------------------------------------------------------------
    # 4. 35+ ORDERS ACROSS CATEGORIES, SOURCES, CHANNELS, AND DATES
    # -----------------------------------------------------------------------------
    def make_item(cat: str, qty: int = 1, discount: int = 0):
        pool = cat_variants.get(cat) or cat_variants.get("mattresses", [])
        chosen = pool[0] if pool else None
        if not chosen:
            return {
                "variant_id": str(uuid.uuid4()),
                "product_id": str(uuid.uuid4()),
                "product_slug": f"kotson-{cat}",
                "product_name": f"Kotson {cat.title()} [TEST]",
                "sku": f"KS-TEST-{cat.upper()[:4]}",
                "size": "King (78x72)",
                "thickness": "8 Inch",
                "firmness": "Medium Firm",
                "qty": qty,
                "unit_price": 25000 * P,
                "line_total": qty * 25000 * P,
            }
        v = chosen["variant"]
        p = chosen["product"]
        price = v.get("price", 25000 * P)
        return {
            "variant_id": v["id"],
            "product_id": p["id"],
            "product_slug": p.get("slug", ""),
            "product_name": p.get("name", ""),
            "sku": v.get("sku", ""),
            "size": v.get("size", "Standard"),
            "thickness": v.get("thickness", "8 Inch"),
            "firmness": v.get("firmness", "Medium Firm"),
            "qty": qty,
            "unit_price": price,
            "line_total": (price * qty) - discount,
        }

    orders_spec = [
        # --- MATTRESS ORDERS (Single Category) ---
        ("ord_001", "KS10001", "customer_001", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["today"], 0),
        ("ord_002", "KS10002", "customer_002", ["mattresses"], "WEB_REFERRAL", "WEBSITE", "paid", "shipped", "CARD", "PAYMENT_GATEWAY", d["yesterday"], 2000*P),
        ("ord_003", "KS10003", "customer_003", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "paid", "processing", "BANK_TRANSFER", "PAYMENT_GATEWAY", d["days_3_ago"], 0),
        ("ord_004", "KS10004", "customer_004", ["mattresses"], "EMPLOYEE_ASSISTED", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["week_ago"], 0),
        ("ord_005", "KS10005", "customer_005", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["days_12_ago"], 0),
        ("ord_006", "KS10006", "customer_006", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_20_ago"], 0),
        ("ord_007", "KS10007", "customer_001", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["last_month"], 0),

        # --- PILLOW ORDERS (Single Category) ---
        ("ord_008", "KS10008", "customer_002", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["today"], 0),
        ("ord_009", "KS10009", "customer_003", ["pillows"], "WEB_REFERRAL", "WEBSITE", "paid", "shipped", "CARD", "PAYMENT_GATEWAY", d["yesterday"], 500*P),
        ("ord_010", "KS10010", "customer_004", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_3_ago"], 0),
        ("ord_011", "KS10011", "customer_005", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["week_ago"], 0),
        ("ord_012", "KS10012", "customer_006", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["days_20_ago"], 0),
        ("ord_013", "KS10013", "customer_007", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["last_month"], 0),

        # --- TOPPER ORDERS (Single Category) ---
        ("ord_014", "KS10014", "customer_003", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["today"], 0),
        ("ord_015", "KS10015", "customer_004", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "processing", "UPI", "PAYMENT_GATEWAY", d["yesterday"], 0),
        ("ord_016", "KS10016", "customer_005", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "shipped", "BANK_TRANSFER", "PAYMENT_GATEWAY", d["week_ago"], 0),
        ("ord_017", "KS10017", "customer_006", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_12_ago"], 0),
        ("ord_018", "KS10018", "customer_007", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["last_month"], 0),

        # --- BABY + KIDS ORDERS (Single Category) ---
        ("ord_019", "KS10019", "customer_004", ["baby-kids"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["today"], 0),
        ("ord_020", "KS10020", "customer_005", ["baby-kids"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["days_3_ago"], 0),
        ("ord_021", "KS10021", "customer_006", ["baby-kids"], "WEB_REFERRAL", "WEBSITE", "paid", "shipped", "UPI", "PAYMENT_GATEWAY", d["week_ago"], 0),
        ("ord_022", "KS10022", "customer_007", ["baby-kids"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_20_ago"], 0),
        ("ord_023", "KS10023", "customer_008", ["baby-kids"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "BANK_TRANSFER", "PAYMENT_GATEWAY", d["last_month"], 0),

        # --- MULTI-CATEGORY ORDERS (Essential for category counting test: 1 Order, 2 Category counts) ---
        ("ord_024", "KS10024", "customer_001", ["mattresses", "pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["today"], 1500*P),
        ("ord_025", "KS10025", "customer_002", ["mattresses", "toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "shipped", "CARD", "PAYMENT_GATEWAY", d["yesterday"], 2500*P),
        ("ord_026", "KS10026", "customer_003", ["baby-kids", "pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_3_ago"], 500*P),
        ("ord_027", "KS10027", "customer_004", ["mattresses", "pillows", "toppers"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "CARD", "PAYMENT_GATEWAY", d["week_ago"], 4000*P),
        ("ord_028", "KS10028", "customer_005", ["mattresses", "pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["days_12_ago"], 1000*P),
        ("ord_029", "KS10029", "customer_006", ["mattresses", "pillows"], "DIRECT_WEBSITE", "WEBSITE", "paid", "delivered", "UPI", "PAYMENT_GATEWAY", d["last_month"], 1000*P),

        # --- IN-STORE MANUAL SALES (Cash, UPI, Admin Recorded) ---
        ("ord_030", "KS10030", "customer_001", ["mattresses"], "WALK_IN", "STORE", "paid", "delivered", "CASH", "ADMIN_RECORDED", d["today"], 0),
        ("ord_031", "KS10031", "customer_002", ["pillows", "toppers"], "WALK_IN", "STORE", "paid", "delivered", "UPI", "ADMIN_RECORDED", d["yesterday"], 500*P),
        ("ord_032", "KS10032", "customer_003", ["mattresses"], "EMPLOYEE_ASSISTED", "STORE", "paid", "delivered", "CARD", "ADMIN_RECORDED", d["days_3_ago"], 1000*P),
        ("ord_033", "KS10033", "customer_004", ["baby-kids"], "PHONE_ORDER", "STORE", "paid", "shipped", "BANK_TRANSFER", "ADMIN_RECORDED", d["week_ago"], 0),
        ("ord_034", "KS10034", "customer_005", ["mattresses", "pillows"], "WALK_IN", "STORE", "paid", "delivered", "CASH", "ADMIN_RECORDED", d["last_month"], 2000*P),

        # --- EXCEPTION & STATUS TESTS (Pending, Failed, Cancelled, Refunded) ---
        ("ord_035", "KS10035", "customer_007", ["mattresses"], "DIRECT_WEBSITE", "WEBSITE", "cancelled", "cancelled", "UPI", "PAYMENT_GATEWAY", d["days_3_ago"], 0),
        ("ord_036", "KS10036", "customer_008", ["pillows"], "DIRECT_WEBSITE", "WEBSITE", "failed", "awaiting_payment", "CARD", "PAYMENT_GATEWAY", d["yesterday"], 0),
        ("ord_037", "KS10037", "customer_001", ["toppers"], "DIRECT_WEBSITE", "WEBSITE", "refunded", "delivered", "UPI", "PAYMENT_GATEWAY", d["week_ago"], 0),
    ]

    orders_map = {}
    for key, onum, cust_key, cats, source, channel, p_status, f_status, p_method, p_source, o_date, disc in orders_spec:
        cust = cust_map[cust_key]
        addr = cust["address"]
        items = [make_item(c, qty=1, discount=disc if i == 0 else 0) for i, c in enumerate(cats)]
        subtotal = sum(it["line_total"] for it in items)
        total = max(0, subtotal)

        # Determine realistic dispatch_status and fulfilment_method for full post-purchase testing
        idx = int(onum.replace("KS100", ""))
        delivered_date = None
        packing_info = None

        if 1 <= idx <= 5:
            d_status = "AWAITING_DISPATCH"
            f_method = "HOME_DELIVERY"
            f_status_actual = "processing"
        elif 6 <= idx <= 10:
            d_status = "READY_TO_PACK"
            f_method = "HOME_DELIVERY"
            f_status_actual = "processing"
        elif 11 <= idx <= 15:
            d_status = "PACKED"
            f_method = "HOME_DELIVERY"
            f_status_actual = "processing"
            packing_info = {
                "packed_by": "rahul.ops@kotsonmattress.com",
                "package_count": 1,
                "package_weight_kg": 36.5,
                "packed_at": o_date.isoformat(),
            }
        elif 16 <= idx <= 20:
            d_status = "IN_TRANSIT"
            f_method = "HOME_DELIVERY"
            f_status_actual = "shipped"
        elif 21 <= idx <= 28:
            d_status = "DELIVERED"
            f_method = "HOME_DELIVERY"
            f_status_actual = "delivered"
            delivered_date = o_date
        elif 29 <= idx <= 31:
            d_status = "DELIVERY_EXCEPTION"
            f_method = "HOME_DELIVERY"
            f_status_actual = "shipped"
        elif 32 <= idx <= 34:
            d_status = "STORE_PICKUP"
            f_method = "STORE_PICKUP"
            f_status_actual = "delivered"
        else:
            d_status = "AWAITING_DISPATCH" if p_status == "paid" else "PENDING_PAYMENT"
            f_method = "HOME_DELIVERY"
            f_status_actual = f_status

        doc = {
            "id": str(uuid.uuid4()),
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "order_number": onum,
            "user_id": cust["id"],
            "email": cust["email"],
            "buyer_type": "CUSTOMER",
            "order_source": source,
            "order_channel": channel,
            "sale_date": o_date,
            "employee_id": staff_map["emp_001"]["id"] if source in ("EMPLOYEE_ASSISTED", "PHONE_ORDER") else None,
            "dealer_id": None,
            "source_note": f"Seeded {source} Order [TEST]",
            "payment_verification_source": p_source,
            "manual_payment_ref": f"TXN-TEST-{onum}" if p_source == "ADMIN_RECORDED" else None,
            "manual_payment_remarks": "In-store manual payment verified [TEST]" if p_source == "ADMIN_RECORDED" else None,
            "items": items,
            "address": addr,
            "amounts": {
                "subtotal": subtotal,
                "discount": disc,
                "tax": 0,
                "tax_status": "included",
                "shipping": 0,
                "shipping_status": "free",
                "total": total,
            },
            "payment_status": p_status,
            "fulfilment_status": f_status_actual,
            "dispatch_status": d_status,
            "fulfilment_method": f_method,
            "delivered_at": delivered_date,
            "packing_info": packing_info,
            "warehouse_id": "Central Fulfillment Hub 01" if idx % 2 == 0 else "South India Distribution Hub 02",
            "reservation_status": "confirmed" if p_status == "paid" else "none",
            "referral_code": cust.get("referral_code") if source == "WEB_REFERRAL" else None,
            "stock_exception": False,
            "events": [
                {"at": o_date.isoformat(), "type": "order_placed", "detail": "Order placed by customer [TEST]", "actor": "customer"},
                {"at": o_date.isoformat(), "type": "payment_settled", "detail": f"Payment {p_status} via {p_method} ({p_source})", "actor": "system"},
            ],
            "created_at": o_date,
            "updated_at": o_date,
        }
        await db.orders.insert_one(doc)
        orders_map[key] = doc

    # -----------------------------------------------------------------------------
    # 5. DEALER WHOLESALE ORDERS
    # -----------------------------------------------------------------------------
    dealer_orders_spec = [
        ("dlr_ord_001", "dealer_001", 5, 250000*P, "approved", "fulfilled", d["today"]),
        ("dlr_ord_002", "dealer_002", 8, 420000*P, "approved", "fulfilled", d["days_3_ago"]),
        ("dlr_ord_003", "dealer_003", 10, 550000*P, "approved", "fulfilled", d["week_ago"]),
        ("dlr_ord_004", "dealer_004", 4, 180000*P, "approved", "fulfilled", d["days_12_ago"]),
        ("dlr_ord_005", "dealer_005", 6, 310000*P, "approved", "fulfilled", d["last_month"]),
        ("dlr_ord_006", "dealer_001", 3, 140000*P, "quote_requested", "quoted", d["yesterday"]),
    ]

    for key, dlr_key, qty, total_p, status, f_status, o_date in dealer_orders_spec:
        dlr = dealer_map[dlr_key]
        sample_v = cat_variants["mattresses"][0]["variant"] if cat_variants["mattresses"] else {}
        doc = {
            "id": str(uuid.uuid4()),
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "dealer_id": dlr["id"],
            "org_name": dlr["org_name"],
            "items": [{
                "variant_id": sample_v.get("id"),
                "sku": sample_v.get("sku", "KS-MATT-01"),
                "product_name": "Kotson Organic Latex Mattress [TEST]",
                "size": "King (78x72)",
                "qty": qty,
            }],
            "status": status,
            "pricing_status": "final",
            "note": "Commercial dealer bulk order [TEST]",
            "amounts": {"total": total_p},
            "created_at": o_date,
        }
        await db.dealer_orders.insert_one(doc)

    # -----------------------------------------------------------------------------
    # 6. CARTS (Active, Abandoned, Converted & Deduplication Test)
    # -----------------------------------------------------------------------------
    cart_specs = [
        ("cart_001", "customer_001", "active", 2, d["today"]),        # Ravi Kumar (Multiple cart updates -> tests Deduplication: Cart Users = 1)
        ("cart_002", "customer_002", "active", 1, d["yesterday"]),
        ("cart_003", "customer_003", "active", 3, d["days_3_ago"]),
        ("cart_004", "customer_004", "abandoned", 1, d["week_ago"]),
        ("cart_005", "customer_005", "abandoned", 2, d["days_12_ago"]),
        ("cart_006", "customer_006", "abandoned", 1, d["days_20_ago"]),
        ("cart_007", "customer_007", "converted", 2, d["last_month"]),
        ("cart_008", "customer_008", "converted", 1, d["last_month"]),
    ]

    for key, cust_key, c_type, item_count, c_date in cart_specs:
        cust = cust_map[cust_key]
        sample_it = make_item("mattresses", qty=1)
        doc = {
            "id": str(uuid.uuid4()),
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "token": f"token-{key}",
            "user_id": cust["id"],
            "customer_id": cust["id"],
            "items": [sample_it] * item_count,
            "status": c_type,
            "updated_at": c_date,
            "created_at": c_date,
        }
        await db.carts.insert_one(doc)

    # -----------------------------------------------------------------------------
    # 7. CRM PIPELINES, CAMPAIGNS & 25+ LEADS
    # -----------------------------------------------------------------------------
    pipeline_specs = [
        ("pipe_001", "retail_sales", "Retail Customer Sales", [
            {"code": "new", "label": "New Inbound", "sort": 1},
            {"code": "contacted", "label": "Contacted", "sort": 2},
            {"code": "interested", "label": "Interested", "sort": 3},
            {"code": "hot", "label": "Hot Lead", "sort": 4},
            {"code": "quote_shared", "label": "Quotation Shared", "sort": 5},
            {"code": "converted", "label": "Converted", "sort": 6, "is_won": True},
            {"code": "lost", "label": "Lost", "sort": 7, "is_lost": True},
        ]),
        ("pipe_002", "abandoned_cart", "Abandoned Cart Recovery", [
            {"code": "new", "label": "Cart Dropped", "sort": 1},
            {"code": "contacted", "label": "WhatsApp Sent", "sort": 2},
            {"code": "followup", "label": "Discount Offered", "sort": 3},
            {"code": "converted", "label": "Recovered", "sort": 4, "is_won": True},
            {"code": "lost", "label": "Abandoned", "sort": 5, "is_lost": True},
        ]),
        ("pipe_003", "dealer_acquisition", "Dealer Acquisition", [
            {"code": "new", "label": "Application Received", "sort": 1},
            {"code": "contacted", "label": "Credentials Verified", "sort": 2},
            {"code": "converted", "label": "Approved Dealer", "sort": 3, "is_won": True},
            {"code": "lost", "label": "Rejected", "sort": 4, "is_lost": True},
        ]),
        ("pipe_004", "high_value_mattress", "High-Value Mattress Leads", [
            {"code": "new", "label": "Premium Inquiry", "sort": 1},
            {"code": "contacted", "label": "Consultation Booked", "sort": 2},
            {"code": "converted", "label": "Custom Order", "sort": 3, "is_won": True},
        ]),
        ("pipe_005", "repeat_customers", "Repeat Customer Retention", [
            {"code": "new", "label": "Trial Completed", "sort": 1},
            {"code": "contacted", "label": "Referral Invitation", "sort": 2},
            {"code": "converted", "label": "Pillow / Topper Add-on", "sort": 3, "is_won": True},
        ]),
    ]

    pipe_map = {}
    for key, code, name, stages in pipeline_specs:
        pid = str(uuid.uuid4())
        doc = {
            "id": pid,
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "code": code,
            "name": f"{name} [TEST]",
            "kind": "sales",
            "stages": stages,
            "is_active": True,
            "created_at": d["last_month"],
        }
        await db.pipelines.insert_one(doc)
        pipe_map[code] = doc

    # 5 Campaigns
    campaign_specs = [
        ("camp_001", "web_mattress_leads", "Website Mattress Inquiries", "registration", "retail_sales"),
        ("camp_002", "sept_abandoned_carts", "September Cart Recovery", "cart_opportunity", "abandoned_cart"),
        ("camp_003", "dealer_telangana", "Dealer Telangana Network", "dealer", "dealer_acquisition"),
        ("camp_004", "latex_enquiries", "7-Zone Latex Ad Campaign", "sales", "high_value_mattress"),
        ("camp_005", "repeat_referrals", "Customer Referral Drive", "sales", "repeat_customers"),
    ]

    camp_map = {}
    for key, code, name, skind, pcode in campaign_specs:
        cid = str(uuid.uuid4())
        doc = {
            "id": cid,
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "code": code,
            "name": f"{name} [TEST]",
            "source_kind": skind,
            "pipeline_id": pipe_map[pcode]["id"],
            "is_active": True,
            "ad_metrics_source": "not_connected",
            "created_at": d["last_month"],
        }
        await db.campaigns.insert_one(doc)
        camp_map[code] = doc

    # 25+ CRM Leads covering ALL stages and boundary scores (19, 20, 49, 50, 85)
    lead_stages_and_scores = [
        # (lead_num, stage, score, kind, city, state, date)
        ("LD1001", "new", 19, "sales", "Hyderabad", "Telangana", d["today"]),              # Cold boundary (19)
        ("LD1002", "new", 20, "sales", "Warangal", "Telangana", d["today"]),               # Warm boundary (20)
        ("LD1003", "contacted", 35, "sales", "Vijayawada", "Andhra Pradesh", d["yesterday"]),
        ("LD1004", "contacted", 45, "cart_opportunity", "Visakhapatnam", "Andhra Pradesh", d["yesterday"]),
        ("LD1005", "interested", 49, "sales", "Tirupati", "Andhra Pradesh", d["days_3_ago"]), # Warm boundary (49)
        ("LD1006", "interested", 50, "sales", "Hyderabad", "Telangana", d["days_3_ago"]),    # Hot boundary (50)
        ("LD1007", "hot", 85, "sales", "Guntur", "Andhra Pradesh", d["week_ago"]),
        ("LD1008", "hot", 90, "sales", "Karimnagar", "Telangana", d["week_ago"]),
        ("LD1009", "quote_shared", 75, "sales", "Hyderabad", "Telangana", d["days_12_ago"]),
        ("LD1010", "quote_shared", 80, "dealer", "Warangal", "Telangana", d["days_12_ago"]),
        ("LD1011", "followup", 65, "cart_opportunity", "Vijayawada", "Andhra Pradesh", d["days_20_ago"]),
        ("LD1012", "followup", 60, "sales", "Visakhapatnam", "Andhra Pradesh", d["days_20_ago"]),
        ("LD1013", "converted", 95, "sales", "Hyderabad", "Telangana", d["last_month"]),
        ("LD1014", "converted", 99, "sales", "Tirupati", "Andhra Pradesh", d["last_month"]),
        ("LD1015", "not_interested", 25, "sales", "Guntur", "Andhra Pradesh", d["last_month"]),
        ("LD1016", "lost", 15, "cart_opportunity", "Karimnagar", "Telangana", d["last_month"]),
        ("LD1017", "new", 30, "sales", "Hyderabad", "Telangana", d["today"]),
        ("LD1018", "contacted", 40, "sales", "Warangal", "Telangana", d["yesterday"]),
        ("LD1019", "interested", 55, "sales", "Vijayawada", "Andhra Pradesh", d["days_3_ago"]),
        ("LD1020", "hot", 88, "sales", "Visakhapatnam", "Andhra Pradesh", d["week_ago"]),
        ("LD1021", "quote_shared", 70, "sales", "Tirupati", "Andhra Pradesh", d["days_12_ago"]),
        ("LD1022", "converted", 92, "dealer", "Hyderabad", "Telangana", d["days_20_ago"]),
        ("LD1023", "lost", 10, "sales", "Guntur", "Andhra Pradesh", d["last_month"]),
        ("LD1024", "new", 22, "sales", "Karimnagar", "Telangana", d["today"]),
        ("LD1025", "contacted", 38, "sales", "Warangal", "Telangana", d["yesterday"]),
    ]

    emp_ids = [staff_map["emp_001"]["id"], staff_map["emp_002"]["id"], staff_map["emp_003"]["id"]]

    for i, (lnum, stage, score, lkind, lcity, lstate, ldate) in enumerate(lead_stages_and_scores):
        assigned_emp = emp_ids[i % len(emp_ids)]
        cust_sample = cust_map[f"customer_00{(i % 8) + 1}"]
        doc = {
            "id": str(uuid.uuid4()),
            "seed_key": f"lead_{lnum.lower()}",
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "lead_number": lnum,
            "customer_id": cust_sample["id"],
            "name": f"{cust_sample['name']}",
            "email": cust_sample["email"],
            "phone": cust_sample["phone"],
            "city": lcity,
            "state": lstate,
            "kind": lkind,
            "pipeline_id": pipe_map["retail_sales"]["id"],
            "campaign_id": camp_map["web_mattress_leads"]["id"],
            "employee_id": assigned_emp,
            "manager_id": staff_map["mgr_001"]["id"],
            "stage": stage,
            "score": score,
            "qualification": "hot" if score >= 50 else ("warm" if score >= 20 else "cold"),
            "is_open": stage not in ("converted", "lost", "not_interested"),
            "source_kind": "website",
            "product_interest": "Kotson Pure 7-Zone Organic Latex Mattress",
            "notes": [
                {"at": ldate.isoformat(), "author_email": staff_map["emp_001"]["email"], "body": f"Customer inquired about natural latex support [TEST]. Stage: {stage}"}
            ],
            "created_at": ldate,
            "updated_at": ldate,
        }
        await db.leads.insert_one(doc)

    # -----------------------------------------------------------------------------
    # 8. OUTBOUND SHIPMENTS & RETURN REQUESTS (Dispatch & Returns)
    # -----------------------------------------------------------------------------
    shipment_specs = [
        # In-Transit (5)
        ("ship_001", "KS10016", "BD-88990016", "BlueDart Surface Logistics", "IN_TRANSIT", d["today"], None),
        ("ship_002", "KS10017", "DL-77665517", "Delhivery Surface", "IN_TRANSIT", d["yesterday"], None),
        ("ship_003", "KS10018", "DT-44332218", "DTDC Express Cargo", "OUT_FOR_DELIVERY", d["yesterday"], None),
        ("ship_004", "KS10019", "BD-88990019", "BlueDart Surface Logistics", "PICKED_UP", d["today"], None),
        ("ship_005", "KS10020", "DL-77665520", "Delhivery Surface", "AT_DESTINATION_HUB", d["days_3_ago"], None),
        # Delivered (5)
        ("ship_006", "KS10021", "BD-88990021", "BlueDart Surface Logistics", "DELIVERED", d["week_ago"], d["days_3_ago"]),
        ("ship_007", "KS10022", "DL-77665522", "Delhivery Surface", "DELIVERED", d["days_12_ago"], d["week_ago"]),
        ("ship_008", "KS10023", "DT-44332223", "DTDC Express Cargo", "DELIVERED", d["days_20_ago"], d["days_12_ago"]),
        ("ship_009", "KS10024", "BD-88990024", "BlueDart Surface Logistics", "DELIVERED", d["last_month"], d["days_20_ago"]),
        ("ship_010", "KS10025", "DL-77665525", "Delhivery Surface", "DELIVERED", d["last_month"], d["days_12_ago"]),
        # Delivery Exceptions (4)
        ("ship_011", "KS10029", "BD-88990029", "BlueDart Surface Logistics", "DELIVERY_ATTEMPT_FAILED", d["yesterday"], None),
        ("ship_012", "KS10030", "DL-77665530", "Delhivery Surface", "DELIVERY_ATTEMPT_FAILED", d["days_3_ago"], None),
        ("ship_013", "KS10031", "DT-44332231", "DTDC Express Cargo", "DELIVERY_ATTEMPT_FAILED", d["days_3_ago"], None),
        ("ship_014", "KS10035", "BD-88990035", "BlueDart Surface Logistics", "DELIVERY_ATTEMPT_FAILED", d["days_3_ago"], None),
    ]

    for key, onum, awb, carrier, s_status, s_date, deliv_date in shipment_specs:
        ord_sample = await db.orders.find_one({"order_number": onum})
        if ord_sample:
            ex_info = None
            if s_status == "DELIVERY_ATTEMPT_FAILED":
                issue_map = {
                    "KS10029": ("CUSTOMER_UNAVAILABLE", 2, "Door locked, customer phone unreachable"),
                    "KS10030": ("WRONG_ADDRESS", 1, "House number not found on Street 4"),
                    "KS10031": ("RESCHEDULE_REQUESTED", 1, "Customer traveling until Saturday"),
                    "KS10035": ("DAMAGED_PACKAGE", 1, "Outer poly packaging scuffed in transit"),
                }
                issue, attempts, note = issue_map.get(onum, ("OTHER", 1, "Delivery exception"))
                ex_info = {
                    "issue_type": issue,
                    "attempt_count": attempts,
                    "assigned_to": "support@kotsonmattress.com",
                    "next_action": "Contact customer to reschedule",
                    "notes": note,
                    "logged_at": s_date.isoformat(),
                    "logged_by": "carrier_dispatch@kotson.com",
                    "status": "OPEN",
                }

            await db.shipments.insert_one({
                "id": str(uuid.uuid4()),
                "seed_key": key,
                "seed_batch_id": SEED_BATCH_ID,
                "is_test_data": True,
                "data_environment": "SEED",
                "shipment_number": f"SHP-{key.upper()}",
                "order_id": ord_sample["id"],
                "order_number": onum,
                "carrier": carrier,
                "awb_number": awb,
                "tracking_reference": awb,
                "tracking_url": f"https://track.kotsonmattress.com/{awb}",
                "status": s_status,
                "weight_kg": 38.5,
                "package_format": "Cylindrical Roll-Pack",
                "delivered_at": deliv_date,
                "exception_info": ex_info,
                "milestones": [
                    {"status": "READY_FOR_PICKUP", "at": s_date, "actor": "system", "note": "Manifest generated"},
                    {"status": s_status, "at": deliv_date or s_date, "actor": carrier, "note": f"Carrier status: {s_status}"},
                ],
                "created_at": s_date,
            })

    # Return requests (Returns & 100-Night Sleep Trial)
    return_specs = [
        # Regular Returns (4)
        ("ret_001", "KS10021", "RET-9901", "return", "requested", "Wrong Size delivered [TEST]", "Customer ordered King size but received Queen size", d["yesterday"]),
        ("ret_002", "KS10022", "RET-9902", "return", "under_review", "Damaged Product [TEST]", "Outer protective packaging damaged during transit", d["days_3_ago"]),
        ("ret_003", "KS10023", "RET-9903", "return", "inspected", "Manufacturing Issue [TEST]", "QC verified: minor stitch asymmetry, item eligible for restock", d["week_ago"]),
        ("ret_004", "KS10024", "RET-9904", "return", "refunded", "Changed Mind [TEST]", "Customer requested refund before unrolling, gateway refund completed", d["days_12_ago"]),
        # 100-Night Sleep Trials (4)
        ("trl_001", "KS10025", "TRL-9905", "trial", "requested", "Trial comfort adjustment [TEST]", "Mattress is slightly firmer than expected for side sleeper", d["yesterday"]),
        ("trl_002", "KS10026", "TRL-9906", "trial", "under_review", "Trial layer exchange [TEST]", "Customer seeking softer comfort topper layer consultation", d["days_3_ago"]),
        ("trl_003", "KS10027", "TRL-9907", "trial", "approved", "100-Night Trial return authorized [TEST]", "Sleep trial return approved by manager for reverse logistics pickup", d["week_ago"]),
        ("trl_004", "KS10028", "TRL-9908", "trial", "completed", "100-Night Trial replacement completed [TEST]", "Replacement mattress delivered and original inspected", d["days_20_ago"]),
    ]

    for key, onum, rnum, kind, r_status, reason, notes, r_date in return_specs:
        ord_sample = await db.orders.find_one({"order_number": onum})
        if ord_sample:
            insp = None
            if r_status in ("inspected", "refunded", "completed"):
                insp = {
                    "condition": "unopened" if r_status == "refunded" else "good",
                    "decision": "restock" if r_status == "inspected" else "refund" if r_status == "refunded" else "replacement",
                    "inspection_notes": "Physical QC inspection completed in Gurugram Hub. Integrity verified.",
                    "inspected_by": "qc.lead@kotsonmattress.com",
                    "inspected_at": r_date.isoformat(),
                }

            await db.return_requests.insert_one({
                "id": str(uuid.uuid4()),
                "seed_key": key,
                "seed_batch_id": SEED_BATCH_ID,
                "is_test_data": True,
                "data_environment": "SEED",
                "request_number": rnum,
                "order_id": ord_sample["id"],
                "order_number": onum,
                "customer_name": (ord_sample.get("address") or {}).get("full_name") or ord_sample.get("email"),
                "kind": kind,
                "status": r_status,
                "reason": reason,
                "customer_notes": notes,
                "inspection": insp,
                "items": ord_sample.get("items", []),
                "raised_by": ord_sample.get("email"),
                "restocked": r_status == "inspected",
                "trail": [
                    {"at": r_date.isoformat(), "actor": ord_sample.get("email"), "status": "requested", "note": "Claim raised by customer"},
                    {"at": r_date.isoformat(), "actor": "support@kotsonmattress.com", "status": r_status, "note": f"Current status: {r_status}"},
                ],
                "created_at": r_date,
            })

    # Seed Default Carriers
    carrier_specs = [
        ("c_001", "BLUEDART", "BlueDart Surface Logistics", "ACTIVE", "Heavy Freight Express", ["Telangana", "Andhra Pradesh", "Karnataka", "PAN India"], True),
        ("c_002", "DELHIVERY", "Delhivery Surface", "ACTIVE", "B2C Heavy Goods", ["Tier 1 & Tier 2 Southern Hubs"], True),
        ("c_003", "DTDC", "DTDC Express Cargo", "ACTIVE", "Regional Surface", ["Hyderabad & Secunderabad Local"], False),
        ("c_004", "SHADOWFAX", "Shadowfax Logistics", "SETUP_REQUIRED", "Hyperlocal Express", ["Hyderabad Metro"], True),
        ("c_005", "KOTSON_FLEET", "Kotson Direct White Glove Delivery", "ACTIVE", "White Glove Unboxing", ["Hyderabad, Secunderabad, Warangal"], True),
    ]

    for c_key, code, name, status, service, regions, cod in carrier_specs:
        await db.carriers.update_one(
            {"code": code},
            {
                "$set": {
                    "code": code,
                    "name": name,
                    "status": status,
                    "service_type": service,
                    "supported_regions": regions,
                    "cod_supported": cod,
                    "seed_batch_id": SEED_BATCH_ID,
                    "is_test_data": True,
                }
            },
            upsert=True,
        )

    # -----------------------------------------------------------------------------
    # 9. REFERRALS & REWARD ENTRIES
    # -----------------------------------------------------------------------------
    reward_specs = [
        ("rew_001", "customer_001", "KS10002", 2000*P, "approved", d["yesterday"]),
        ("rew_002", "customer_002", "KS10009", 500*P, "approved", d["yesterday"]),
        ("rew_003", "customer_003", "KS10021", 1000*P, "pending", d["week_ago"]),
        ("rew_004", "customer_004", "KS10026", 500*P, "paid", d["days_12_ago"]),
        ("rew_005", "customer_005", "KS10028", 1000*P, "paid", d["last_month"]),
    ]

    for key, cust_key, onum, amount, r_status, r_date in reward_specs:
        cust = cust_map[cust_key]
        ord_doc = await db.orders.find_one({"order_number": onum})
        order_id = ord_doc["id"] if ord_doc else str(uuid.uuid4())
        await db.reward_ledger.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "order_id": order_id,
            "code": cust.get("referral_code") or f"REF-{key}",
            "user_id": cust["id"],
            "order_number": onum,
            "type": "referrer_commission",
            "amount": amount,
            "status": r_status,
            "created_at": r_date,
        })

    # -----------------------------------------------------------------------------
    # 10. REALISTIC PRIVILEGED AUDIT LOGS
    # -----------------------------------------------------------------------------
    audit_logs_spec = [
        ("Dealer Approved", "dealer", "dealer_001", "Approved wholesale dealership terms [TEST]", d["days_3_ago"]),
        ("Manual Sale Created", "order", "KS10030", "Recorded counter cash sale of 7-Zone King Mattress [TEST]", d["today"]),
        ("Inventory Stock Updated", "variant", "KS-MATT-01", "Added +10 physical stock count from warehouse [TEST]", d["yesterday"]),
        ("Lead Stage Updated", "lead", "LD1001", "Transitioned lead from New to Contacted [TEST]", d["today"]),
        ("Campaign Created", "campaign", "camp_001", "Launched Website Mattress Inquiries pipeline campaign [TEST]", d["last_month"]),
        ("Order Transitioned", "order", "KS10002", "Status changed from processing to shipped (AWB: DL-44332211) [TEST]", d["yesterday"]),
        ("Return QC Approved", "return_request", "RET-9901", "Passed foam resilience inspection; restocked unit [TEST]", d["week_ago"]),
        ("Referral Commission Approved", "reward", "rew_001", "Approved ₹20.00 referral bonus for customer_001 [TEST]", d["yesterday"]),
    ]

    for action, entity, eid, detail, a_date in audit_logs_spec:
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "actor_id": staff_map["mgr_001"]["id"],
            "actor_email": staff_map["mgr_001"]["email"],
            "action": action,
            "entity": entity,
            "entity_id": eid,
            "detail": detail,
            "created_at": a_date.isoformat(),
        })

    # -----------------------------------------------------------------------------
    # 11. ASSET LIBRARY SEED RECORDS
    # -----------------------------------------------------------------------------
    assets_spec = [
        ("asset_001", "Kotson Master Brand Identity Logo", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&auto=format&fit=crop&q=60", "Logos", "512x128", 512, 128, 48.5, "image/webp", "Official Kotson Brand Logo", ["branding", "logo", "header"]),
        ("asset_002", "7-Zone Orthopedic Layer Breakdown Diagram", "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&auto=format&fit=crop&q=80", "Product Media", "1200x800", 1200, 800, 245.0, "image/webp", "Exploded Anatomical Foam Structure", ["diagram", "ortho", "7-zone"]),
        ("asset_003", "CertiPUR-US Certified Seal Emblem", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80", "Certifications", "400x400", 400, 400, 38.0, "image/webp", "CertiPUR-US Seal of Safety", ["cert", "trust", "seal"]),
        ("asset_004", "100-Night Risk-Free Sleep Trial Seal", "https://images.unsplash.com/photo-1579656592043-a20e25a4aa4b?w=400&auto=format&fit=crop&q=80", "Trust", "400x400", 400, 400, 42.0, "image/webp", "100-Night Trial Guarantee", ["trial", "warranty", "badge"]),
        ("asset_005", "Organic Pin-Core Latex Cross Section", "https://images.unsplash.com/photo-1629949009765-40fc74c95018?w=1080&auto=format&fit=crop&q=80", "Product Media", "1080x720", 1080, 720, 195.0, "image/webp", "Natural Organic Pin-Core Latex", ["latex", "materials", "macro"]),
        ("asset_006", "Festive Sleep Season Promotional Banner", "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1920&auto=format&fit=crop&q=80", "Banners", "1920x600", 1920, 600, 410.0, "image/jpeg", "Festive Season Bedroom Showcase", ["hero", "festive", "sale"]),
    ]

    for a_key, a_title, a_url, a_cat, a_dim, a_w, a_h, a_size, a_type, a_alt, a_tags in assets_spec:
        await db.asset_library.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": a_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "title": f"{a_title} [TEST]",
            "url": a_url,
            "category": a_cat,
            "dimensions": a_dim,
            "width": a_w,
            "height": a_h,
            "file_size_kb": a_size,
            "file_type": a_type,
            "alt_text": a_alt,
            "tags": a_tags,
            "created_at": d["week_ago"],
            "updated_at": d["yesterday"],
        })

    # -----------------------------------------------------------------------------
    # 12. CERTIFICATIONS SEED RECORDS
    # -----------------------------------------------------------------------------
    certs_spec = [
        ("cert_001", "ISO 9001:2015 Quality Management System", "International Organization for Standardization", "ISO-IND-9001-2024", "2024-01-15", "2027-01-14", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300", "https://iso.org/verify/ISO-IND-9001-2024", "VERIFIED", 1),
        ("cert_002", "CertiPUR-US® Certified Non-Toxic Foam", "CertiPUR-US Testing Laboratories", "CPUS-2026-KT98", "2024-03-01", "2026-03-01", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300", "https://certipur.us/verify/CPUS-2026-KT98", "VERIFIED", 2),
        ("cert_003", "OEKO-TEX® Standard 100 Class 1 (Baby Safe)", "OEKO-TEX International Association", "21.HIN.99882", "2023-11-20", "2025-11-19", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300", "https://oeko-tex.com/verify/21.HIN.99882", "VERIFIED", 3),
        ("cert_004", "IS 19830 Spine Support & Durability Compliance", "Bureau of Indian Standards (BIS)", "CM/L-8822001", "2023-06-10", "2026-06-09", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300", "https://bis.gov.in/verify/CM-L-8822001", "VERIFIED", 4),
        ("cert_005", "Indian Sleep Research Ergonomic Endorsement", "Indian Sleep Research Board (ISRA)", "ISRA-REC-2025", "2022-09-01", "2024-09-01", "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300", "https://isra-sleep.org/verify/ISRA-REC-2025", "PENDING_RENEWAL", 5),
    ]

    for c_key, c_title, c_issuer, c_num, c_issue, c_exp, c_badge, c_vlink, c_stat, c_ord in certs_spec:
        await db.certifications.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": c_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "title": f"{c_title} [TEST]",
            "issuer": c_issuer,
            "cert_number": c_num,
            "issue_date": c_issue,
            "expiry_date": c_exp,
            "badge_image_url": c_badge,
            "verification_url": c_vlink,
            "applicable_products": ["ALL"],
            "display_order": c_ord,
            "is_visible": True,
            "status": c_stat,
            "created_at": d["last_month"],
            "updated_at": d["yesterday"],
        })

    # -----------------------------------------------------------------------------
    # 13. TESTED CLAIMS SEED RECORDS
    # -----------------------------------------------------------------------------
    claims_spec = [
        ("claim_001", "Zero Motion Partner Isolation 99.4%", "Independent mechanical sensor tests measure 99.4% dampening of reciprocal movement shockwaves.", "Ergonomics", "VERIFIED", 1),
        ("claim_002", "10-Year Sag-Proof Height Retention Guarantee", "Simulated 140kg mechanical roller test shows <1.8mm indentation after 100,000 cycles.", "Durability", "VERIFIED", 2),
        ("claim_003", "100% Breathable Natural Pin-Core Latex", "Open-cell micro-ventilation drops mattress sleeping microclimate temperature by 3.2°C.", "Materials", "VERIFIED", 3),
        ("claim_004", "7-Zone Ergonomic Targeted Spinal Alignment", "Clinical posture pressure mapping proves 41% reduced peak lumbar and shoulder stress.", "Ergonomics", "VERIFIED", 4),
        ("claim_005", "100-Night Zero-Risk At-Home Sleep Trial", "100% full money-back guarantee with zero collection or transport fee deduction.", "Trial & Warranty", "VERIFIED", 5),
    ]

    for cl_key, cl_title, cl_proof, cl_cat, cl_vstat, cl_ord in claims_spec:
        await db.claims_trust.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": cl_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "title": f"{cl_title} [TEST]",
            "metric_proof": cl_proof,
            "category": cl_cat,
            "applicable_products": ["ALL"],
            "evidence_doc_url": "https://kotsonmattress.com/docs/clinical-report.pdf",
            "verification_status": cl_vstat,
            "verification_notes": "Verified by Chief Ergonomics Officer [TEST]",
            "display_order": cl_ord,
            "is_visible": True,
            "created_at": d["last_month"],
            "updated_at": d["today"],
        })

    # -----------------------------------------------------------------------------
    # 14. REFER & EARN RULES, REWARDS, AND WITHDRAWALS
    # -----------------------------------------------------------------------------
    ref_rules_spec = [
        ("rule_001", "Global Storewide Refer & Earn Tier", "PERCENTAGE", 5.0, 5000.0, None),
        ("rule_002", "7-Zone Ortho Elite Referral Incentive", "PERCENTAGE", 8.0, 15000.0, "prod_001"),
        ("rule_003", "Hybrid Pocket Spring Fixed Bonus", "FIXED", 2000.0, 20000.0, "prod_002"),
        ("rule_004", "Pure Natural Latex Executive Bounty", "PERCENTAGE", 10.0, 25000.0, "prod_003"),
        ("rule_005", "Ergonomic Pillow Quick Starter", "FIXED", 350.0, 2500.0, "prod_004"),
    ]

    for r_key, r_name, r_type, r_val, r_min, r_pid in ref_rules_spec:
        await db.referral_rules.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": r_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "rule_name": f"{r_name} [TEST]",
            "reward_type": r_type,
            "value": r_val,
            "min_order_value": r_min,
            "product_id": r_pid,
            "first_order_only": False,
            "is_active": True,
            "created_at": d["last_month"],
            "updated_at": d["yesterday"],
        })

    # Seed Referral Rewards Ledger
    rewards_spec = [
        ("rw_001", "KS10001", cust_map["customer_001"], "Ravi Kumar", "KSRAVI01", "Suresh Reddy", 1750.0, "approved", d["days_12_ago"]),
        ("rw_002", "KS10002", cust_map["customer_002"], "Suresh Reddy", "KSSURE02", "Anil Kumar", 2400.0, "paid", d["days_20_ago"]),
        ("rw_003", "KS10003", cust_map["customer_003"], "Anil Kumar", "KSANIL03", "Priya Sharma", 1950.0, "pending", d["days_3_ago"]),
        ("rw_004", "KS10004", cust_map["customer_004"], "Priya Sharma", "KSPRIY04", "Rahul Verma", 2100.0, "held", d["week_ago"]),
        ("rw_005", "KS10005", cust_map["customer_005"], "Rahul Verma", "KSRAHU05", "Deepa Nair", 3200.0, "approved", d["yesterday"]),
    ]

    for rw_key, rw_ord, rw_uid, rw_rname, rw_code, rw_cname, rw_amt, rw_stat, rw_date in rewards_spec:
        await db.referral_rewards.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": rw_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "order_number": rw_ord,
            "user_id": rw_uid,
            "referrer_name": rw_rname,
            "referrer_code": rw_code,
            "customer_name": rw_cname,
            "amount": rw_amt,
            "status": rw_stat,
            "created_at": rw_date,
            "updated_at": rw_date,
        })

    # Seed Referral Withdrawals Queue
    withdrawals_spec = [
        ("wdr_001", cust_map["customer_002"], "Suresh Reddy", "suresh.test@example.com", "+919999900002", 2400.0, "PAID", "KOTSONUTR992810", "NEFT/RTGS", d["days_12_ago"]),
        ("wdr_002", cust_map["customer_001"], "Ravi Kumar", "ravi.test@example.com", "+919999900001", 1750.0, "PENDING", None, None, d["yesterday"]),
        ("wdr_003", cust_map["customer_005"], "Rahul Verma", "rahul.test@example.com", "+919999900005", 3200.0, "PENDING", None, None, d["today"]),
        ("wdr_004", cust_map["customer_007"], "Karthik Raja", "karthik.test@example.com", "+919999900007", 1500.0, "PROCESSING", None, "UPI", d["days_3_ago"]),
        ("wdr_005", cust_map["customer_008"], "Sneha Rao", "sneha.test@example.com", "+919999900008", 4500.0, "PAID", "UPI77123990044", "UPI", d["days_20_ago"]),
    ]

    for w_key, w_uid, w_name, w_email, w_phone, w_amt, w_stat, w_utr, w_method, w_date in withdrawals_spec:
        await db.referral_withdrawals.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": w_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "user_id": w_uid,
            "user_name": w_name,
            "user_email": w_email,
            "user_phone": w_phone,
            "amount": w_amt,
            "status": w_stat,
            "utr_number": w_utr,
            "payment_method": w_method,
            "payment_date": w_date.strftime("%Y-%m-%d") if w_stat == "PAID" else None,
            "created_at": w_date,
            "updated_at": w_date,
        })

    # -----------------------------------------------------------------------------
    # 15. DEALER PRICING RULES (Global vs Dealer Overrides)
    # -----------------------------------------------------------------------------
    dealer_rules_spec = [
        ("dlr_rule_001", None, None, "PERCENTAGE", 25.0, 1, 30),  # Global Tier
        ("dlr_rule_002", "prod_001", None, "PERCENTAGE", 28.0, 5, 45),  # 7-Zone Ortho volume incentive
        ("dlr_rule_003", "prod_002", None, "FIXED", 6500.0, 2, 30),  # Pocket Spring fixed discount
        ("dlr_rule_004", None, "dealer_001", "PERCENTAGE", 30.0, 10, 60),  # Top Dealer Hyderabad Override
        ("dlr_rule_005", "prod_003", "dealer_002", "FIXED", 9000.0, 1, 45),  # Bangalore Dealer Latex Special
    ]

    for dr_key, dr_pid, dr_did, dr_type, dr_val, dr_qty, dr_cdays in dealer_rules_spec:
        await db.dealer_pricing_rules.insert_one({
            "id": str(uuid.uuid4()),
            "seed_key": dr_key,
            "seed_batch_id": SEED_BATCH_ID,
            "is_test_data": True,
            "data_environment": "SEED",
            "product_id": dr_pid,
            "dealer_id": dr_did,
            "rule_type": dr_type,
            "discount_value": dr_val,
            "min_order_qty": dr_qty,
            "credit_days": dr_cdays,
            "is_active": True,
            "created_at": d["last_month"],
            "updated_at": d["yesterday"],
        })

    # -----------------------------------------------------------------------------
    # 16. RECORD SEED BATCH ANCHOR
    # -----------------------------------------------------------------------------
    await db.seed_batches.insert_one({
        "batch_id": SEED_BATCH_ID,
        "environment": "DEV",
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    })

    return await get_test_data_status(db)


async def remove_kotson_test_data(db) -> Dict[str, Any]:
    """Completely and safely purges all seeded test records in reverse relational dependency order."""
    query = {"$or": [{"seed_batch_id": SEED_BATCH_ID}, {"is_test_data": True}]}

    # 1. Reverse logistics and audit trails
    await db.calls.delete_many(query)
    await db.follow_ups.delete_many(query)
    await db.shipments.delete_many(query)
    await db.return_requests.delete_many(query)
    await db.refunds.delete_many(query)
    await db.carriers.delete_many(query)
    await db.reward_ledger.delete_many(query)
    await db.referral_clicks.delete_many(query)
    await db.referral_attributions.delete_many(query)
    await db.inventory_ledger.delete_many(query)

    # 2. Carts, Orders, and Dealer Orders
    await db.dealer_orders.delete_many(query)
    await db.dealers.delete_many(query)
    await db.carts.delete_many(query)
    await db.orders.delete_many(query)

    # 3. CRM Leads, Campaigns, Pipelines
    await db.leads.delete_many(query)
    await db.campaigns.delete_many(query)
    await db.pipelines.delete_many(query)
    await db.crm_notes.delete_many(query)

    # 4. Users (test customers & test staff)
    await db.users.delete_many(query)
    await db.audit_log.delete_many(query)

    # 5. Modules: Assets, Claims, Refer & Earn, Dealer Pricing
    await db.asset_library.delete_many(query)
    await db.certifications.delete_many(query)
    await db.claims_trust.delete_many(query)
    await db.referral_rules.delete_many(query)
    await db.referral_rewards.delete_many(query)
    await db.referral_withdrawals.delete_many(query)
    await db.dealer_pricing_rules.delete_many(query)

    # 5. Restore any altered variant stock states back to baseline
    await db.variants.update_many(
        {"seed_batch_id": SEED_BATCH_ID},
        {"$set": {"stock": 10, "reserved": 0, "free_stock": 10}, "$unset": {"seed_batch_id": "", "is_seed_adjusted": ""}}
    )

    # 6. Remove batch anchor
    await db.seed_batches.delete_many({"batch_id": SEED_BATCH_ID})

    return {
        "ok": True,
        "message": f"Successfully purged all test records for batch {SEED_BATCH_ID}",
        "batch_id": SEED_BATCH_ID,
    }
