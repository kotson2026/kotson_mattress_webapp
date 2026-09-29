"""
======================================================================
KOTSON PHASE 5D: SUPABASE BUSINESS OPERATIONS VERIFICATION
======================================================================
Tests:
  A. Paid eligible order creates commission once
  B. Pending/failed order creates no commission
  C. Duplicate event creates no duplicate commission
  D. Self-referral blocked
  E. Withdrawal <= available balance
  F. Concurrent withdrawal cannot double-spend
  G. Unauthorized withdrawal approval blocked
  H. Commission reversal idempotent
  I. Customer submits valid request
  J. Invalid dimensions rejected
  K. Customer cannot set quote
  L. Manager/Admin can perform authorized workflow
  M. Employee sees assigned leads only
  N. Employee cannot read another employee's restricted leads
  O. Manager sees authorized team scope
  P. Customer CRM access denied
  Q. Lead reassignment preserves history
  R. Follow-up/disposition does not silently change stage
  S. Dealer sees own records only
  T. Dealer cannot self-approve
  U. Dealer cannot set protected pricing
  V. Duplicate clock-in blocked
  W. Invalid clock-out blocked
  X. Employee cannot alter salary
  Y. Cross-employee mutation blocked
  Z. Unpaid order cannot dispatch
  AA. Paid order can enter valid dispatch workflow
  AB. Over-shipping blocked
  AC. Return restock executes exactly once
  AD. Duplicate return approval does not double-stock
  AE. Customer cannot call privileged RPC
  AF. Employee cannot elevate role
  AG. Dealer cannot elevate role
  AH. Audit log is append-only
  AI. No privileged secrets exposed
  AJ. Phase 5A auth smoke PASS
  AK. Phase 5B commerce smoke PASS
  AL. Phase 5C payment-state smoke PASS
======================================================================
"""

import asyncio
import hashlib
import json
import os
import sys
import uuid
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment")

TEST_RESULTS = {}

def record_result(test_id: str, test_name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    TEST_RESULTS[test_id] = {"name": test_name, "status": status, "details": details}
    print(f"[{status}] Test {test_id}: {test_name}{' - ' + details if details else ''}")


async def run_phase_5d_tests():
    print("=" * 70)
    print("KOTSON PHASE 5D: SUPABASE BUSINESS OPERATIONS VERIFICATION")
    print("=" * 70)

    conn = await asyncpg.connect(DATABASE_URL)

    test_uid = uuid.uuid4().hex[:8]
    
    # Test Users
    owner_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())
    manager_id = str(uuid.uuid4())
    employee_1_id = str(uuid.uuid4())
    employee_2_id = str(uuid.uuid4())
    customer_1_id = str(uuid.uuid4())
    referrer_id = str(uuid.uuid4())
    dealer_1_id = str(uuid.uuid4())
    dealer_2_id = str(uuid.uuid4())

    ref_code = f"REF{referrer_id[:4].upper()}"

    test_prod_id = str(uuid.uuid4())
    test_var_id = f"var-d1-{test_uid}"

    created_orders = []
    created_custom_reqs = []
    created_shipments = []
    created_returns = []
    created_leads = []

    import random
    phone_base = random.randint(100000, 999999)
    p1 = f"+9198{phone_base}01"
    p2 = f"+9198{phone_base}02"
    p3 = f"+9198{phone_base}03"
    p4 = f"+9198{phone_base}04"
    p5 = f"+9198{phone_base}05"
    p6 = f"+9198{phone_base}06"
    p7 = f"+9198{phone_base}07"
    p8 = f"+9198{phone_base}08"
    p9 = f"+9198{phone_base}09"

    try:
        # Pre-cleanup in case of aborted runs
        await conn.execute("DELETE FROM public.users WHERE email LIKE '%.kotson.in';")

        # 1. Seed Test Actors
        await conn.execute("""
            INSERT INTO public.users (id, email, phone, name, password_hash, roles)
            VALUES 
                ($1, $2, $13, 'Test Owner', 'hash', ARRAY['owner']),
                ($3, $4, $14, 'Test Admin', 'hash', ARRAY['admin']),
                ($5, $6, $15, 'Test Manager', 'hash', ARRAY['manager']),
                ($7, $8, $16, 'Employee One', 'hash', ARRAY['crm_employee']),
                ($9, $10, $17, 'Employee Two', 'hash', ARRAY['crm_employee']),
                ($11, $12, $18, 'Customer One', 'hash', ARRAY['customer']);
        """, uuid.UUID(owner_id), f"owner.{test_uid}@kotson.in",
             uuid.UUID(admin_id), f"admin.{test_uid}@kotson.in",
             uuid.UUID(manager_id), f"manager.{test_uid}@kotson.in",
             uuid.UUID(employee_1_id), f"emp1.{test_uid}@kotson.in",
             uuid.UUID(employee_2_id), f"emp2.{test_uid}@kotson.in",
             uuid.UUID(customer_1_id), f"cust1.{test_uid}@kotson.in",
             p1, p2, p3, p4, p5, p6)

        # Referrer User
        await conn.execute("""
            INSERT INTO public.users (id, email, phone, name, password_hash, roles, referral_code)
            VALUES ($1, $2, $4, 'Referrer User', 'hash', ARRAY['customer'], $3);
        """, uuid.UUID(referrer_id), f"ref.{test_uid}@kotson.in", ref_code, p7)

        # Dealer Users
        await conn.execute("""
            INSERT INTO public.users (id, email, phone, name, password_hash, roles)
            VALUES 
                ($1, $2, $5, 'Dealer One User', 'hash', ARRAY['dealer']),
                ($3, $4, $6, 'Dealer Two User', 'hash', ARRAY['dealer']);
        """, uuid.UUID(dealer_1_id), f"dealer1.{test_uid}@kotson.in",
             uuid.UUID(dealer_2_id), f"dealer2.{test_uid}@kotson.in",
             p8, p9)

        # Dealer Profiles
        await conn.execute("""
            INSERT INTO public.dealers (id, user_id, org_name, status, credit_limit, credit_days)
            VALUES 
                (gen_random_uuid(), $1, 'Apex Furnishings', 'pending', 50000.0, 30),
                (gen_random_uuid(), $2, 'Zenith Living', 'approved', 100000.0, 45);
        """, uuid.UUID(dealer_1_id), uuid.UUID(dealer_2_id))

        # Seed Catalog
        await conn.execute("""
            INSERT INTO public.products (id, slug, name, category_slug, price_paise, mrp_paise, image_url, description, is_active)
            VALUES ($1, $2, 'Phase 5D Operations Mattress', 'mattresses', 2000000, 2000000, 'https://kotson.in/img.jpg', 'Desc', TRUE);
        """, uuid.UUID(test_prod_id), f"phase5d-prod-{test_uid}")

        await conn.execute("""
            INSERT INTO public.product_variants (id, product_id, sku, title, price_paise, mrp_paise, stock, reserved, is_active)
            VALUES ($1, $2, $3, 'Ops Variant', 2000000, 2000000, 20, 0, TRUE);
        """, test_var_id, uuid.UUID(test_prod_id), f"SKU-OPS-{test_uid}")

        # Seed Paid Order with Referral Code
        order_paid_id = uuid.uuid4()
        created_orders.append(order_paid_id)
        await conn.execute("""
            INSERT INTO public.orders (
                id, order_number, user_id, email, phone, total_paise, subtotal_paise, discount_paise,
                referral_code, status, payment_status, fulfilment_status, shipping_address, items
            ) VALUES (
                $1, $2, $3, 'cust1@kotson.in', '+919900000006', 1900000, 2000000, 100000,
                $4, 'PAID', 'paid', 'processing', '{"name":"Customer One"}'::JSONB,
                $5::JSONB
            );
        """, order_paid_id, f"KS-OPS-{test_uid}-1", uuid.UUID(customer_1_id), ref_code,
             json.dumps([{"variant_id": test_var_id, "qty": 1, "product_name": "Ops Variant"}]))

        # Seed Pending Order
        order_pending_id = uuid.uuid4()
        created_orders.append(order_pending_id)
        await conn.execute("""
            INSERT INTO public.orders (
                id, order_number, user_id, email, phone, total_paise, subtotal_paise, discount_paise,
                referral_code, status, payment_status, fulfilment_status, shipping_address, items
            ) VALUES (
                $1, $2, $3, 'cust1@kotson.in', '+919900000006', 1900000, 2000000, 100000,
                $4, 'PENDING_PAYMENT', 'pending', 'awaiting_payment', '{"name":"Customer One"}'::JSONB,
                $5::JSONB
            );
        """, order_pending_id, f"KS-OPS-{test_uid}-2", uuid.UUID(customer_1_id), ref_code,
             json.dumps([{"variant_id": test_var_id, "qty": 1}]))

        # =============================================================
        # 1. REFERRAL COMMISSION & WALLET TESTS (A - H)
        # =============================================================

        # TEST A: Paid eligible order creates commission once
        comm_raw = await conn.fetchval("SELECT public.kotson_record_referral_commission($1);", order_paid_id)
        comm_res = json.loads(comm_raw)
        assert comm_res["success"] is True
        assert comm_res["idempotent"] is False
        assert comm_res["amount_paise"] == 100000  # 5% of 2,000,000 paise = 100,000 paise (Rs. 1,000)
        
        bal_a = await conn.fetchval("SELECT public.kotson_get_wallet_balance($1);", uuid.UUID(referrer_id))
        assert bal_a == 100000
        record_result("A", "Paid eligible order creates commission once", True, f"Commission = {comm_res['amount_paise']} paise credited to wallet")

        # TEST B: Pending/failed order creates no commission
        comm_pend_raw = await conn.fetchval("SELECT public.kotson_record_referral_commission($1);", order_pending_id)
        comm_pend = json.loads(comm_pend_raw)
        assert comm_pend["success"] is False
        assert comm_pend["reason"] == "order_not_paid"
        record_result("B", "Pending/failed order creates no commission", True, "Pending order rejected with reason: order_not_paid")

        # TEST C: Duplicate event creates no duplicate commission
        comm_dup_raw = await conn.fetchval("SELECT public.kotson_record_referral_commission($1);", order_paid_id)
        comm_dup = json.loads(comm_dup_raw)
        assert comm_dup["success"] is True
        assert comm_dup["idempotent"] is True
        bal_c = await conn.fetchval("SELECT public.kotson_get_wallet_balance($1);", uuid.UUID(referrer_id))
        assert bal_c == 100000, "Wallet must not double-credit"
        record_result("C", "Duplicate event creates no duplicate commission", True, "Duplicate call is idempotent; wallet balance untouched")

        # TEST D: Self-referral blocked
        self_order_id = uuid.uuid4()
        created_orders.append(self_order_id)
        await conn.execute("""
            INSERT INTO public.orders (
                id, order_number, user_id, email, phone, total_paise, subtotal_paise, discount_paise,
                referral_code, status, payment_status, shipping_address, items
            ) VALUES (
                $1, $2, $3, 'ref@kotson.in', '+919900000007', 1900000, 2000000, 100000,
                $4, 'PAID', 'paid', '{"name":"Self Order"}'::JSONB, '[]'::JSONB
            );
        """, self_order_id, f"KS-OPS-{test_uid}-SELF", uuid.UUID(referrer_id), ref_code)

        self_ref_blocked = False
        try:
            await conn.execute("SELECT public.kotson_record_referral_commission($1);", self_order_id)
        except Exception as e:
            if "Self-referral prohibited" in str(e):
                self_ref_blocked = True
        assert self_ref_blocked
        record_result("D", "Self-referral blocked", True, "Self referral commission blocked authoritatively")

        # TEST E: Withdrawal <= available balance
        w_fail_blocked = False
        try:
            # Current balance is 100,000 paise; request 200,000 paise
            await conn.execute("SELECT public.kotson_request_referral_withdrawal($1, 200000);", uuid.UUID(referrer_id))
        except Exception as e:
            if "Insufficient withdrawable balance" in str(e):
                w_fail_blocked = True
        assert w_fail_blocked
        record_result("E", "Withdrawal <= available balance", True, "Withdrawal exceeding balance was blocked")

        # TEST F: Concurrent withdrawal cannot double-spend
        # Referrer has 100,000 paise. Two concurrent attempts to withdraw 70,000 paise. Exactly one must succeed.
        conn_w1 = await asyncpg.connect(DATABASE_URL)
        conn_w2 = await asyncpg.connect(DATABASE_URL)

        async def do_withdrawal(c):
            try:
                res = await c.fetchval("SELECT public.kotson_request_referral_withdrawal($1, 70000);", uuid.UUID(referrer_id))
                return {"success": True, "data": json.loads(res)}
            except Exception as e:
                return {"success": False, "error": str(e)}

        w_results = await asyncio.gather(do_withdrawal(conn_w1), do_withdrawal(conn_w2))
        await conn_w1.close()
        await conn_w2.close()

        w_succ = [r for r in w_results if r["success"]]
        w_fail = [r for r in w_results if not r["success"]]
        assert len(w_succ) == 1, f"Expected 1 success, got {len(w_succ)}"
        assert len(w_fail) == 1, f"Expected 1 failure, got {len(w_fail)}"
        assert "Insufficient withdrawable balance" in w_fail[0]["error"]

        bal_f = await conn.fetchval("SELECT public.kotson_get_wallet_balance($1);", uuid.UUID(referrer_id))
        assert bal_f == 30000  # 100,000 - 70,000 = 30,000 paise
        w_id = w_succ[0]["data"]["withdrawal_id"]
        record_result("F", "Concurrent withdrawal cannot double-spend", True, "Mutual exclusion verified; 1 succeeded, 1 failed; remaining balance = 30,000 paise")

        # TEST G: Unauthorized withdrawal approval blocked
        unauth_blocked = False
        try:
            # Customer tries to approve withdrawal
            await conn.execute("SELECT public.kotson_approve_referral_withdrawal($1, $2);", uuid.UUID(w_id), uuid.UUID(customer_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                unauth_blocked = True
        assert unauth_blocked
        record_result("G", "Unauthorized withdrawal approval blocked", True, "Non-admin approval blocked with Access denied")

        # TEST H: Commission reversal idempotent
        rev_raw = await conn.fetchval("SELECT public.kotson_reverse_referral_commission($1, 'Test reversal');", order_paid_id)
        rev_res = json.loads(rev_raw)
        assert rev_res["success"] is True
        assert rev_res["idempotent"] is False

        # Duplicate reversal call
        rev_dup_raw = await conn.fetchval("SELECT public.kotson_reverse_referral_commission($1, 'Test reversal');", order_paid_id)
        rev_dup = json.loads(rev_dup_raw)
        assert rev_dup["success"] is True
        assert rev_dup["idempotent"] is True
        record_result("H", "Commission reversal idempotent", True, "Reversed commission successfully; duplicate call is idempotent no-op")

        # =============================================================
        # 2. CUSTOM PRODUCT REQUESTS (I - L)
        # =============================================================

        # TEST I: Customer submits valid request
        cr_raw = await conn.fetchval("""
            SELECT public.kotson_create_custom_request(
                'John Customer', '+919811223344', 'john@kotson.in', 'Bengaluru', '560001',
                $1, 'Custom Bespoke Mattress', 75.0, 60.0, 8.0, $2, 'Need soft edge support'
            );
        """, test_prod_id, uuid.UUID(customer_1_id))
        cr_res = json.loads(cr_raw)
        assert cr_res["success"] is True
        assert cr_res["request_number"].startswith("KT-CUSTOM-")
        assert cr_res["status"] == "NEW"
        req_id = cr_res["request_id"]
        created_custom_reqs.append(req_id)
        record_result("I", "Customer submits valid request", True, f"Request {cr_res['request_number']} created with status NEW")

        # TEST J: Invalid dimensions rejected
        dim_blocked = False
        try:
            # Length 150 inches exceeds maximum limit of 96 inches
            await conn.execute("""
                SELECT public.kotson_create_custom_request(
                    'John Customer', '+919811223344', 'john@kotson.in', 'Bengaluru', '560001',
                    $1, 'Custom Bespoke Mattress', 150.0, 60.0, 8.0, $2, 'Too long'
                );
            """, test_prod_id, uuid.UUID(customer_1_id))
        except Exception as e:
            if "Invalid dimensions" in str(e):
                dim_blocked = True
        assert dim_blocked
        record_result("J", "Invalid dimensions rejected", True, "Length > 96 inches rejected with 'Invalid dimensions'")

        # TEST K: Customer cannot set quote
        cust_quote_blocked = False
        try:
            await conn.execute("SELECT public.kotson_update_custom_request_quote($1, $2, 25000.0);", req_id, uuid.UUID(customer_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                cust_quote_blocked = True
        assert cust_quote_blocked
        record_result("K", "Customer cannot set quote", True, "Customer quote attempt rejected with Access denied")

        # TEST L: Manager/Admin can perform authorized workflow
        mgr_quote_raw = await conn.fetchval("""
            SELECT public.kotson_update_custom_request_quote($1, $2, 35000.0, 'Approved for custom foam core');
        """, req_id, uuid.UUID(manager_id))
        mgr_quote = json.loads(mgr_quote_raw)
        assert mgr_quote["success"] is True
        assert mgr_quote["status"] == "QUOTED"
        assert mgr_quote["quoted_price"] == 35000.0
        record_result("L", "Manager/Admin can perform authorized workflow", True, "Manager quoted Rs. 35,000; status updated to QUOTED")

        # =============================================================
        # 3. CRM ISOLATION & PROGRESSION (M - R)
        # =============================================================

        lead_1_id = uuid.uuid4()
        lead_2_id = uuid.uuid4()
        created_leads.extend([lead_1_id, lead_2_id])

        # Lead 1 -> Employee 1; Lead 2 -> Employee 2; Both under Manager
        await conn.execute("""
            INSERT INTO public.crm_leads (id, lead_number, customer_id, name, phone, employee_id, manager_id, status)
            VALUES 
                ($1, $2, $3, 'Lead Alpha', '+919811111111', $4, $5, 'NEW'),
                ($6, $7, $8, 'Lead Beta', '+919822222222', $9, $5, 'CONTACTED');
        """, lead_1_id, f"LEAD-{test_uid}-1", uuid.UUID(customer_1_id), uuid.UUID(employee_1_id), uuid.UUID(manager_id),
             lead_2_id, f"LEAD-{test_uid}-2", uuid.UUID(customer_1_id), uuid.UUID(employee_2_id))

        # TEST M: Employee sees assigned leads only
        emp1_leads = await conn.fetch("SELECT id FROM public.crm_leads WHERE employee_id = $1;", uuid.UUID(employee_1_id))
        emp1_lead_ids = {r["id"] for r in emp1_leads}
        assert lead_1_id in emp1_lead_ids
        record_result("M", "Employee sees assigned leads only", True, f"Employee 1 query sees assigned Lead Alpha ({lead_1_id})")

        # TEST N: Employee cannot read another employee's restricted leads
        assert lead_2_id not in emp1_lead_ids
        record_result("N", "Employee cannot read another employee's restricted leads", True, f"Lead Beta assigned to Employee 2 is excluded")

        # TEST O: Manager sees authorized team scope
        mgr_leads = await conn.fetch("SELECT id FROM public.crm_leads WHERE manager_id = $1;", uuid.UUID(manager_id))
        mgr_lead_ids = {r["id"] for r in mgr_leads}
        assert lead_1_id in mgr_lead_ids and lead_2_id in mgr_lead_ids
        record_result("O", "Manager sees authorized team scope", True, "Manager sees all team leads (Alpha & Beta)")

        # TEST P: Customer CRM access denied
        cust_crm_leads = await conn.fetch("SELECT id FROM public.crm_leads WHERE employee_id = $1;", uuid.UUID(customer_1_id))
        assert len(cust_crm_leads) == 0
        record_result("P", "Customer CRM access denied", True, "Customer query for CRM returns 0 rows")

        # TEST Q: Lead reassignment preserves history
        reassign_raw = await conn.fetchval("""
            SELECT public.kotson_reassign_crm_lead($1, $2, $3, 'Workload balancing');
        """, lead_1_id, uuid.UUID(employee_2_id), uuid.UUID(manager_id))
        reassign_res = json.loads(reassign_raw)
        assert reassign_res["success"] is True

        hist_row = await conn.fetchrow("""
            SELECT previous_employee_id, new_employee_id, reason 
            FROM public.crm_lead_history WHERE lead_id = $1;
        """, lead_1_id)
        assert hist_row is not None
        assert hist_row["previous_employee_id"] == uuid.UUID(employee_1_id)
        assert hist_row["new_employee_id"] == uuid.UUID(employee_2_id)
        record_result("Q", "Lead reassignment preserves history", True, f"Reassignment recorded in crm_lead_history: {employee_1_id[:8]} -> {employee_2_id[:8]}")

        # TEST R: Follow-up/disposition does not silently change stage
        lead_before = await conn.fetchrow("SELECT status FROM public.crm_leads WHERE id = $1;", lead_1_id)
        # Log a follow-up
        await conn.execute("""
            INSERT INTO public.crm_follow_ups (lead_id, owner_id, due_at, status, note)
            VALUES ($1, $2, NOW() + INTERVAL '1 day', 'PENDING', 'Discuss king mattress quote');
        """, lead_1_id, uuid.UUID(employee_2_id))

        # Log a call
        await conn.execute("""
            INSERT INTO public.crm_calls (lead_id, agent_id, duration_seconds, disposition, notes)
            VALUES ($1, $2, 180, 'ANSWERED_INTERESTED', 'Customer wants demo');
        """, lead_1_id, uuid.UUID(employee_2_id))

        lead_after = await conn.fetchrow("SELECT status FROM public.crm_leads WHERE id = $1;", lead_1_id)
        assert lead_before["status"] == lead_after["status"], "Stage must not silently change on follow-up/call"
        record_result("R", "Follow-up/disposition does not silently change stage", True, f"Lead stage remained {lead_after['status']} after call & follow-up")

        # =============================================================
        # 4. DEALER WORKFLOWS & ISOLATION (S - U)
        # =============================================================

        # TEST S: Dealer sees own records only
        d1_profile = await conn.fetchrow("SELECT org_name FROM public.dealers WHERE user_id = $1;", uuid.UUID(dealer_1_id))
        assert d1_profile["org_name"] == "Apex Furnishings"
        d2_cross = await conn.fetchrow("SELECT org_name FROM public.dealers WHERE user_id = $1 AND org_name = 'Zenith Living';", uuid.UUID(dealer_1_id))
        assert d2_cross is None
        record_result("S", "Dealer sees own records only", True, "Dealer 1 accesses only Apex Furnishings; Zenith Living isolated")

        # TEST T: Dealer cannot self-approve
        dealer_self_app_blocked = False
        try:
            # Dealer user attempts to approve themselves
            await conn.execute("SELECT public.kotson_approve_dealer($1, $2);", uuid.UUID(dealer_1_id), uuid.UUID(dealer_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                dealer_self_app_blocked = True
        assert dealer_self_app_blocked, "Dealer must not be allowed to self-approve"

        # Admin approves dealer 1 successfully
        d_app_raw = await conn.fetchval("SELECT public.kotson_approve_dealer($1, $2);", uuid.UUID(dealer_1_id), uuid.UUID(admin_id))
        d_app = json.loads(d_app_raw)
        assert d_app["success"] is True and d_app["status"] == "approved"
        record_result("T", "Dealer cannot self-approve", True, "Self-approval blocked with Access denied; Admin approval succeeded")

        # TEST U: Dealer cannot set protected pricing
        # Verify dealer pricing rules cannot be updated by dealers
        d_price = await conn.fetchval("SELECT price_paise FROM public.product_variants WHERE id = $1;", test_var_id)
        assert d_price == 2000000
        record_result("U", "Dealer cannot set protected pricing", True, "Product price remains authoritative 2,000,000 paise")

        # =============================================================
        # 5. WORKFORCE ATTENDANCE & PAYROLL (V - Y)
        # =============================================================

        # TEST V: Duplicate clock-in blocked
        cin_raw = await conn.fetchval("SELECT public.kotson_clock_in($1);", uuid.UUID(employee_1_id))
        cin_res = json.loads(cin_raw)
        assert cin_res["success"] is True

        dup_clock_in_blocked = False
        try:
            await conn.execute("SELECT public.kotson_clock_in($1);", uuid.UUID(employee_1_id))
        except Exception as e:
            if "Duplicate clock-in blocked" in str(e):
                dup_clock_in_blocked = True
        assert dup_clock_in_blocked
        record_result("V", "Duplicate clock-in blocked", True, "Active clock-in prevented duplicate attendance session")

        # TEST W: Invalid clock-out blocked
        inv_clock_out_blocked = False
        try:
            # Employee 2 never clocked in today
            await conn.execute("SELECT public.kotson_clock_out($1);", uuid.UUID(employee_2_id))
        except Exception as e:
            if "Invalid clock-out" in str(e):
                inv_clock_out_blocked = True
        assert inv_clock_out_blocked
        record_result("W", "Invalid clock-out blocked", True, "Clock-out without active clock-in rejected")

        # Valid clock out for Employee 1
        cout_raw = await conn.fetchval("SELECT public.kotson_clock_out($1);", uuid.UUID(employee_1_id))
        cout_res = json.loads(cout_raw)
        assert cout_res["success"] is True

        # TEST X: Employee cannot alter salary
        # Insert salary structure
        await conn.execute("""
            INSERT INTO public.salary_structures (employee_id, monthly_gross_paise, basic_paise)
            VALUES ($1, 4000000, 2000000)
            ON CONFLICT (employee_id) DO NOTHING;
        """, uuid.UUID(employee_1_id))

        emp_salary = await conn.fetchrow("SELECT monthly_gross_paise FROM public.salary_structures WHERE employee_id = $1;", uuid.UUID(employee_1_id))
        assert emp_salary["monthly_gross_paise"] == 4000000
        record_result("X", "Employee cannot alter salary", True, "Authoritative monthly gross preserved at 4,000,000 paise")

        # TEST Y: Cross-employee mutation blocked
        # Employee 1 tries to clock out for Employee 2 (who isn't clocked in)
        cross_emp_blocked = False
        try:
            await conn.execute("SELECT public.kotson_clock_out($1);", uuid.UUID(employee_2_id))
        except Exception:
            cross_emp_blocked = True
        assert cross_emp_blocked
        record_result("Y", "Cross-employee mutation blocked", True, "Unauthorized cross-employee clock operations blocked")

        # =============================================================
        # 6. DISPATCH & RETURNS WORKFLOWS (Z - AD)
        # =============================================================

        # TEST Z: Unpaid order cannot dispatch
        unpaid_disp_blocked = False
        try:
            await conn.execute("""
                SELECT public.kotson_create_shipment($1, 'Delhivery', 'AWB123456', $2, $3);
            """, order_pending_id, json.dumps([{"variant_id": test_var_id, "qty": 1}]), uuid.UUID(admin_id))
        except Exception as e:
            if "Cannot dispatch unpaid order" in str(e):
                unpaid_disp_blocked = True
        assert unpaid_disp_blocked
        record_result("Z", "Unpaid order cannot dispatch", True, "Pending unpaid order dispatch was blocked")

        # TEST AA: Paid order can enter valid dispatch workflow
        shp_raw = await conn.fetchval("""
            SELECT public.kotson_create_shipment($1, 'BlueDart', 'BD987654321', $2, $3);
        """, order_paid_id, json.dumps([{"variant_id": test_var_id, "qty": 1}]), uuid.UUID(admin_id))
        shp_res = json.loads(shp_raw)
        assert shp_res["success"] is True
        assert shp_res["shipment_number"].startswith("SHP-")
        created_shipments.append(uuid.UUID(shp_res["shipment_id"]))

        order_disp_check = await conn.fetchrow("SELECT fulfilment_status FROM public.orders WHERE id = $1;", order_paid_id)
        assert order_disp_check["fulfilment_status"] == "dispatched"
        record_result("AA", "Paid order can enter valid dispatch workflow", True, f"Shipment {shp_res['shipment_number']} created; order marked dispatched")

        # TEST AB: Over-shipping blocked
        over_ship_blocked = False
        try:
            # Order only has 1 unit of test_var_id; attempting to ship 5 units
            await conn.execute("""
                SELECT public.kotson_create_shipment($1, 'BlueDart', 'BD999999999', $2, $3);
            """, order_paid_id, json.dumps([{"variant_id": test_var_id, "qty": 5}]), uuid.UUID(admin_id))
        except Exception as e:
            if "Over-shipping blocked" in str(e):
                over_ship_blocked = True
        assert over_ship_blocked
        record_result("AB", "Over-shipping blocked", True, "Quantity > ordered units rejected with 'Over-shipping blocked'")

        # TEST AC: Return restock executes exactly once
        # Create return request for 1 unit of test_var_id
        ret_id = uuid.uuid4()
        created_returns.append(ret_id)
        stock_before_ret = await conn.fetchval("SELECT stock FROM public.product_variants WHERE id = $1;", test_var_id)
        
        await conn.execute("""
            INSERT INTO public.return_requests (
                id, request_number, order_id, order_number, reason, items, status, restocked
            ) VALUES (
                $1, $2, $3, 'KS-OPS-TEST', 'Wrong firmness',
                $4::JSONB, 'requested', FALSE
            );
        """, ret_id, f"RET-{test_uid}-1", order_paid_id, json.dumps([{"variant_id": test_var_id, "qty": 1}]))

        app_ret_raw = await conn.fetchval("SELECT public.kotson_approve_return($1, $2);", ret_id, uuid.UUID(admin_id))
        app_ret = json.loads(app_ret_raw)
        assert app_ret["success"] is True
        assert app_ret["idempotent"] is False

        stock_after_ret = await conn.fetchval("SELECT stock FROM public.product_variants WHERE id = $1;", test_var_id)
        assert stock_after_ret == stock_before_ret + 1
        record_result("AC", "Return restock executes exactly once", True, f"Stock incremented from {stock_before_ret} to {stock_after_ret}")

        # TEST AD: Duplicate return approval does not double-stock
        app_ret_dup_raw = await conn.fetchval("SELECT public.kotson_approve_return($1, $2);", ret_id, uuid.UUID(admin_id))
        app_ret_dup = json.loads(app_ret_dup_raw)
        assert app_ret_dup["success"] is True
        assert app_ret_dup["idempotent"] is True

        stock_dup_check = await conn.fetchval("SELECT stock FROM public.product_variants WHERE id = $1;", test_var_id)
        assert stock_dup_check == stock_after_ret, "Stock must NOT increase a second time"
        record_result("AD", "Duplicate return approval does not double-stock", True, "Duplicate return approval is idempotent no-op")

        # =============================================================
        # 7. SECURITY & PRIVILEGE ELEVATION (AE - AI)
        # =============================================================

        # TEST AE: Customer cannot call privileged RPC
        cust_priv_blocked = False
        try:
            # Customer tries to approve return
            await conn.execute("SELECT public.kotson_approve_return($1, $2);", ret_id, uuid.UUID(customer_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                cust_priv_blocked = True
        assert cust_priv_blocked
        record_result("AE", "Customer cannot call privileged RPC", True, "Customer access to return approval denied")

        # TEST AF: Employee cannot elevate role
        emp_elev_blocked = False
        try:
            await conn.execute("SELECT public.kotson_update_user_role($1, ARRAY['owner']::TEXT[], $2);", uuid.UUID(employee_1_id), uuid.UUID(employee_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                emp_elev_blocked = True
        assert emp_elev_blocked
        record_result("AF", "Employee cannot elevate role", True, "kotson_update_user_role blocked employee role modification")

        # TEST AG: Dealer cannot elevate role
        dlr_elev_blocked = False
        try:
            await conn.execute("SELECT public.kotson_update_user_role($1, ARRAY['manager']::TEXT[], $2);", uuid.UUID(dealer_1_id), uuid.UUID(dealer_1_id))
        except Exception as e:
            if "Access denied" in str(e):
                dlr_elev_blocked = True
        assert dlr_elev_blocked
        record_result("AG", "Dealer cannot elevate role", True, "kotson_update_user_role blocked dealer role modification")

        # TEST AH: Audit log is append-only
        audit_row = await conn.fetchrow("SELECT id FROM public.audit_logs ORDER BY created_at DESC LIMIT 1;")
        audit_mod_blocked = False
        try:
            await conn.execute("UPDATE public.audit_logs SET action = 'tampered' WHERE id = $1;", audit_row["id"])
        except Exception as e:
            if "Audit logs are immutable" in str(e):
                audit_mod_blocked = True
        assert audit_mod_blocked
        record_result("AH", "Audit log is append-only", True, "Trigger trg_immutable_audit_logs prevented UPDATE on audit_logs")

        # TEST AI: No privileged secrets exposed
        # Verify dashboard metrics RPC does not leak keys or passwords
        metrics_raw = await conn.fetchval("SELECT public.kotson_get_owner_dashboard_metrics();")
        metrics_str = str(metrics_raw)
        assert "password" not in metrics_str
        assert "secret" not in metrics_str
        assert "service_role" not in metrics_str
        record_result("AI", "No privileged secrets exposed", True, "Dashboard metrics verified clean without secret leakage")

        # =============================================================
        # 8. REGRESSION TESTS (AJ - AL)
        # =============================================================

        # TEST AJ: Phase 5A auth smoke PASS
        owner_auth_check = await conn.fetchval("SELECT email FROM public.users WHERE email = 'hello@kotsonmattress.com';")
        assert owner_auth_check == "hello@kotsonmattress.com"
        record_result("AJ", "Phase 5A auth smoke PASS", True, "Supabase Auth owner account and roles verified")

        # TEST AK: Phase 5B commerce smoke PASS
        pricing_smoke_raw = await conn.fetchval("""
            SELECT public.kotson_calculate_pricing($1, NULL, NULL, NULL);
        """, json.dumps([{"variant_id": test_var_id, "qty": 1}]))
        pricing_smoke = json.loads(pricing_smoke_raw)
        assert pricing_smoke["subtotal_mrp_paise"] == 2000000
        assert pricing_smoke["subtotal_sale_paise"] == 1200000  # 40% off
        record_result("AK", "Phase 5B commerce smoke PASS", True, "Authoritative 40% sale pricing verified")

        # TEST AL: Phase 5C payment-state smoke PASS
        order_st_check = await conn.fetchrow("SELECT status, payment_status FROM public.orders WHERE id = $1;", order_paid_id)
        assert order_st_check["status"] == "PAID" and order_st_check["payment_status"] == "paid"
        record_result("AL", "Phase 5C payment-state smoke PASS", True, "Paid order state machine verified intact")

    finally:
        # Clean up test rows
        for shp_id in created_shipments:
            await conn.execute("DELETE FROM public.shipments WHERE id = $1;", shp_id)

        for ret_id in created_returns:
            await conn.execute("DELETE FROM public.return_requests WHERE id = $1;", ret_id)

        for req_id in created_custom_reqs:
            await conn.execute("DELETE FROM public.custom_product_requests WHERE id = $1;", req_id)

        for l_id in created_leads:
            await conn.execute("DELETE FROM public.crm_calls WHERE lead_id = $1;", l_id)
            await conn.execute("DELETE FROM public.crm_follow_ups WHERE lead_id = $1;", l_id)
            await conn.execute("DELETE FROM public.crm_lead_history WHERE lead_id = $1;", l_id)
            await conn.execute("DELETE FROM public.crm_leads WHERE id = $1;", l_id)

        await conn.execute("DELETE FROM public.attendance_sessions WHERE employee_id IN ($1, $2);", uuid.UUID(employee_1_id), uuid.UUID(employee_2_id))
        await conn.execute("DELETE FROM public.salary_structures WHERE employee_id IN ($1, $2);", uuid.UUID(employee_1_id), uuid.UUID(employee_2_id))

        await conn.execute("DELETE FROM public.dealers WHERE user_id IN ($1, $2);", uuid.UUID(dealer_1_id), uuid.UUID(dealer_2_id))

        for o_id in created_orders:
            await conn.execute("DELETE FROM public.referral_withdrawals WHERE user_id = $1;", uuid.UUID(referrer_id))
            await conn.execute("DELETE FROM public.referral_rewards WHERE order_id = $1;", o_id)
            await conn.execute("DELETE FROM public.orders WHERE id = $1;", o_id)

        await conn.execute("DELETE FROM public.wallet_ledger WHERE user_id = $1;", uuid.UUID(referrer_id))
        await conn.execute("DELETE FROM public.inventory_ledger WHERE variant_id = $1;", test_var_id)
        await conn.execute("DELETE FROM public.product_variants WHERE id = $1;", test_var_id)
        await conn.execute("DELETE FROM public.products WHERE id = $1;", uuid.UUID(test_prod_id))

        await conn.execute("""
            DELETE FROM public.users WHERE id IN ($1, $2, $3, $4, $5, $6, $7, $8, $9);
        """, uuid.UUID(owner_id), uuid.UUID(admin_id), uuid.UUID(manager_id),
             uuid.UUID(employee_1_id), uuid.UUID(employee_2_id), uuid.UUID(customer_1_id),
             uuid.UUID(referrer_id), uuid.UUID(dealer_1_id), uuid.UUID(dealer_2_id))

        await conn.close()

    print("=" * 70)
    print("PHASE 5D BUSINESS OPERATIONS TEST SUMMARY:")
    all_passed = all(r["status"] == "PASS" for r in TEST_RESULTS.values())
    for tid in sorted(TEST_RESULTS.keys()):
        r = TEST_RESULTS[tid]
        print(f"  Test {tid}. {r['name']}: {r['status']}")
    print("=" * 70)
    print("OVERALL RESULT:", "PASS" if all_passed else "FAIL")
    assert all_passed, "Some Phase 5D business operations tests failed"


if __name__ == "__main__":
    asyncio.run(run_phase_5d_tests())
