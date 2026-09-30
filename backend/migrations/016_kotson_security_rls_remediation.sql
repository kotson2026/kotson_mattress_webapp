-- Migration 016: Kotson Security Advisor & RLS Remediation
-- Remediates all 31 critical findings (30 tables with RLS disabled + 1 with policy exists & RLS disabled)
-- Architecture: Vercel Frontend + Supabase Backend (Auth, Edge Functions, RPCs)

BEGIN;

-- ============================================================================
-- 1. ASSETS (Storefront Media & CMS Assets)
-- ============================================================================
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_read_public" ON public.assets;
CREATE POLICY "assets_read_public" ON public.assets
    FOR SELECT
    USING (is_archived IS NOT TRUE OR public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "assets_admin_all" ON public.assets;
CREATE POLICY "assets_admin_all" ON public.assets
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 2. CUSTOM PRODUCT DIMENSION CONFIG (Storefront Calculator Config)
-- ============================================================================
ALTER TABLE public.custom_product_dimension_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dimension_config_read_public" ON public.custom_product_dimension_config;
CREATE POLICY "dimension_config_read_public" ON public.custom_product_dimension_config
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "dimension_config_admin_all" ON public.custom_product_dimension_config;
CREATE POLICY "dimension_config_admin_all" ON public.custom_product_dimension_config
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 3. REFERRAL RULES (Active Referral Commission & Discount Rules)
-- ============================================================================
ALTER TABLE public.referral_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_rules_read_active" ON public.referral_rules;
CREATE POLICY "referral_rules_read_active" ON public.referral_rules
    FOR SELECT
    USING (is_active = true OR public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "referral_rules_admin_all" ON public.referral_rules;
CREATE POLICY "referral_rules_admin_all" ON public.referral_rules
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 4. CARRIERS (Logistics Shipping Partners)
-- ============================================================================
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carriers_read_active" ON public.carriers;
CREATE POLICY "carriers_read_active" ON public.carriers
    FOR SELECT
    USING (status = 'active' OR public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "carriers_admin_all" ON public.carriers;
CREATE POLICY "carriers_admin_all" ON public.carriers
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 5. SETTINGS (Storefront & Application Settings)
-- ============================================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_public" ON public.settings;
CREATE POLICY "settings_read_public" ON public.settings
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "settings_admin_all" ON public.settings;
CREATE POLICY "settings_admin_all" ON public.settings
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 6. STATUS CHECKS (Health Check Table)
-- ============================================================================
ALTER TABLE public.status_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_checks_read_public" ON public.status_checks;
CREATE POLICY "status_checks_read_public" ON public.status_checks
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "status_checks_admin_all" ON public.status_checks;
CREATE POLICY "status_checks_admin_all" ON public.status_checks
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 7. REFERRAL CLICKS (Anonymous Click Tracking)
-- ============================================================================
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referral_clicks_insert_public" ON public.referral_clicks;
CREATE POLICY "referral_clicks_insert_public" ON public.referral_clicks
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "referral_clicks_admin_read" ON public.referral_clicks;
CREATE POLICY "referral_clicks_admin_read" ON public.referral_clicks
    FOR SELECT
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "referral_clicks_admin_manage" ON public.referral_clicks;
CREATE POLICY "referral_clicks_admin_manage" ON public.referral_clicks
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 8. CUSTOM PRODUCT REQUESTS (Bespoke Mattress Requests)
-- ============================================================================
ALTER TABLE public.custom_product_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_requests_select" ON public.custom_product_requests;
CREATE POLICY "custom_requests_select" ON public.custom_product_requests
    FOR SELECT
    USING (
        customer_id = public.get_current_user_id()
        OR assigned_to_user_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "custom_requests_insert" ON public.custom_product_requests;
CREATE POLICY "custom_requests_insert" ON public.custom_product_requests
    FOR INSERT
    WITH CHECK (
        customer_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "custom_requests_update" ON public.custom_product_requests;
CREATE POLICY "custom_requests_update" ON public.custom_product_requests
    FOR UPDATE
    USING (
        assigned_to_user_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        assigned_to_user_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "custom_requests_delete" ON public.custom_product_requests;
CREATE POLICY "custom_requests_delete" ON public.custom_product_requests
    FOR DELETE
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 9. RETURN REQUESTS (Order Returns & Exchanges)
-- ============================================================================
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_requests_select" ON public.return_requests;
CREATE POLICY "return_requests_select" ON public.return_requests
    FOR SELECT
    USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = public.get_current_user_id())
        OR public.is_staff()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "return_requests_insert" ON public.return_requests;
CREATE POLICY "return_requests_insert" ON public.return_requests
    FOR INSERT
    WITH CHECK (
        order_id IN (SELECT id FROM public.orders WHERE user_id = public.get_current_user_id())
        OR public.is_staff()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "return_requests_manage" ON public.return_requests;
CREATE POLICY "return_requests_manage" ON public.return_requests
    FOR ALL
    USING (
        public.is_staff()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.is_staff()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 10. DEALER ORDERS (B2B Bulk Orders)
-- ============================================================================
ALTER TABLE public.dealer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealer_orders_select" ON public.dealer_orders;
CREATE POLICY "dealer_orders_select" ON public.dealer_orders
    FOR SELECT
    USING (
        dealer_id IN (SELECT id FROM public.dealers WHERE user_id = public.get_current_user_id())
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "dealer_orders_insert" ON public.dealer_orders;
CREATE POLICY "dealer_orders_insert" ON public.dealer_orders
    FOR INSERT
    WITH CHECK (
        dealer_id IN (SELECT id FROM public.dealers WHERE user_id = public.get_current_user_id())
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "dealer_orders_manage" ON public.dealer_orders;
CREATE POLICY "dealer_orders_manage" ON public.dealer_orders
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 11. DEALER PRICING RULES (B2B Volume & Tier Discounts)
-- ============================================================================
ALTER TABLE public.dealer_pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealer_pricing_select" ON public.dealer_pricing_rules;
CREATE POLICY "dealer_pricing_select" ON public.dealer_pricing_rules
    FOR SELECT
    USING (
        dealer_id IN (SELECT id FROM public.dealers WHERE user_id = public.get_current_user_id())
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "dealer_pricing_admin_all" ON public.dealer_pricing_rules;
CREATE POLICY "dealer_pricing_admin_all" ON public.dealer_pricing_rules
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 12. CRM CALLS (Telephonic Sales Activity)
-- ============================================================================
ALTER TABLE public.crm_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_calls_select" ON public.crm_calls;
CREATE POLICY "crm_calls_select" ON public.crm_calls
    FOR SELECT
    USING (
        agent_id = public.get_current_user_id()
        OR public.user_has_role('crm_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "crm_calls_insert" ON public.crm_calls;
CREATE POLICY "crm_calls_insert" ON public.crm_calls
    FOR INSERT
    WITH CHECK (
        agent_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "crm_calls_admin_all" ON public.crm_calls;
CREATE POLICY "crm_calls_admin_all" ON public.crm_calls
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 13. CRM FOLLOW UPS (Scheduled Lead Tasks)
-- ============================================================================
ALTER TABLE public.crm_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_follow_ups_select" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_select" ON public.crm_follow_ups
    FOR SELECT
    USING (
        owner_id = public.get_current_user_id()
        OR public.user_has_role('crm_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "crm_follow_ups_modify" ON public.crm_follow_ups;
CREATE POLICY "crm_follow_ups_modify" ON public.crm_follow_ups
    FOR ALL
    USING (
        owner_id = public.get_current_user_id()
        OR public.user_has_role('crm_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        owner_id = public.get_current_user_id()
        OR public.user_has_role('crm_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 14. ATTENDANCE SESSIONS (Punch in/out shifts)
-- ============================================================================
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_sessions_select" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_select" ON public.attendance_sessions
    FOR SELECT
    USING (
        employee_id = public.get_current_user_id()
        OR manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "attendance_sessions_employee_write" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_employee_write" ON public.attendance_sessions
    FOR INSERT
    WITH CHECK (
        employee_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "attendance_sessions_employee_update" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_employee_update" ON public.attendance_sessions
    FOR UPDATE
    USING (
        employee_id = public.get_current_user_id()
        OR manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        employee_id = public.get_current_user_id()
        OR manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "attendance_sessions_admin_all" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_admin_all" ON public.attendance_sessions
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 15. ATTENDANCE CORRECTIONS (Regularization Requests)
-- ============================================================================
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_corrections_select" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_select" ON public.attendance_corrections
    FOR SELECT
    USING (
        employee_id = public.get_current_user_id()
        OR public.user_has_role('manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "attendance_corrections_insert" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_insert" ON public.attendance_corrections
    FOR INSERT
    WITH CHECK (
        employee_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "attendance_corrections_manage" ON public.attendance_corrections;
CREATE POLICY "attendance_corrections_manage" ON public.attendance_corrections
    FOR ALL
    USING (
        public.user_has_role('manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.user_has_role('manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 16. LEAVE REQUESTS (Time Off Submissions)
-- ============================================================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
    FOR SELECT
    USING (
        employee_id = public.get_current_user_id()
        OR manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
    FOR INSERT
    WITH CHECK (
        employee_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
    FOR UPDATE
    USING (
        manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        manager_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "leave_requests_admin_all" ON public.leave_requests;
CREATE POLICY "leave_requests_admin_all" ON public.leave_requests
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 17. PAYROLL PERIODS (Monthly Salary Cycles)
-- ============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_periods_admin_all" ON public.payroll_periods;
CREATE POLICY "payroll_periods_admin_all" ON public.payroll_periods
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 18. PAYROLL RECORDS (Individual Employee Payslips)
-- ============================================================================
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_records_select" ON public.payroll_records;
CREATE POLICY "payroll_records_select" ON public.payroll_records
    FOR SELECT
    USING (
        employee_id = public.get_current_user_id()
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "payroll_records_admin_manage" ON public.payroll_records;
CREATE POLICY "payroll_records_admin_manage" ON public.payroll_records
    FOR ALL
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 19. PAYMENTS (Razorpay & Order Transactions)
-- ============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT
    USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = public.get_current_user_id())
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "payments_admin_service_mutate" ON public.payments;
CREATE POLICY "payments_admin_service_mutate" ON public.payments
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner())
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner());


-- ============================================================================
-- 20. REFUNDS (Payment Returns)
-- ============================================================================
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refunds_select" ON public.refunds;
CREATE POLICY "refunds_select" ON public.refunds
    FOR SELECT
    USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = public.get_current_user_id())
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "refunds_admin_service_mutate" ON public.refunds;
CREATE POLICY "refunds_admin_service_mutate" ON public.refunds
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner())
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner());


-- ============================================================================
-- 21. SHIPMENTS (Waybills & Tracking)
-- ============================================================================
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipments_select" ON public.shipments;
CREATE POLICY "shipments_select" ON public.shipments
    FOR SELECT
    USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = public.get_current_user_id())
        OR public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "shipments_manage" ON public.shipments;
CREATE POLICY "shipments_manage" ON public.shipments
    FOR ALL
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 22. INVENTORY RESERVATIONS (Cart Checkout Hold - Enable RLS)
-- ============================================================================
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_reservations" ON public.inventory_reservations;
CREATE POLICY "admin_all_reservations" ON public.inventory_reservations
    FOR ALL
    USING (public.is_admin_or_owner())
    WITH CHECK (public.is_admin_or_owner());

DROP POLICY IF EXISTS "customer_read_own_reservations" ON public.inventory_reservations;
CREATE POLICY "customer_read_own_reservations" ON public.inventory_reservations
    FOR SELECT
    USING ((user_id = public.get_current_user_id()) OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "service_role_all_reservations" ON public.inventory_reservations;
CREATE POLICY "service_role_all_reservations" ON public.inventory_reservations
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 23. INVENTORY LEDGER (Audit Log for Stock Movements)
-- ============================================================================
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_ledger_admin_select" ON public.inventory_ledger;
CREATE POLICY "inventory_ledger_admin_select" ON public.inventory_ledger
    FOR SELECT
    USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "inventory_ledger_service_role_all" ON public.inventory_ledger;
CREATE POLICY "inventory_ledger_service_role_all" ON public.inventory_ledger
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 24. STOCK DISPATCHES (Warehouse Shipments)
-- ============================================================================
ALTER TABLE public.stock_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_dispatches_select" ON public.stock_dispatches;
CREATE POLICY "stock_dispatches_select" ON public.stock_dispatches
    FOR SELECT
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "stock_dispatches_manage" ON public.stock_dispatches;
CREATE POLICY "stock_dispatches_manage" ON public.stock_dispatches
    FOR ALL
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 25. STOCK TRANSACTIONS (Warehouse Stock In/Out)
-- ============================================================================
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_transactions_select" ON public.stock_transactions;
CREATE POLICY "stock_transactions_select" ON public.stock_transactions
    FOR SELECT
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "stock_transactions_manage" ON public.stock_transactions;
CREATE POLICY "stock_transactions_manage" ON public.stock_transactions
    FOR ALL
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 26. MANUAL STOCK ITEMS (Raw Material & Custom Inventory)
-- ============================================================================
ALTER TABLE public.manual_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_stock_select" ON public.manual_stock_items;
CREATE POLICY "manual_stock_select" ON public.manual_stock_items
    FOR SELECT
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

DROP POLICY IF EXISTS "manual_stock_manage" ON public.manual_stock_items;
CREATE POLICY "manual_stock_manage" ON public.manual_stock_items
    FOR ALL
    USING (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        public.user_has_role('stock_point_manager')
        OR public.is_admin_or_owner()
        OR (auth.jwt() ->> 'role') = 'service_role'
    );


-- ============================================================================
-- 27. PASSWORD RESETS (Private Security Tokens - Edge Functions Only)
-- ============================================================================
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_resets_service_role_only" ON public.password_resets;
CREATE POLICY "password_resets_service_role_only" ON public.password_resets
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role')
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');


-- ============================================================================
-- 28. COUNTERS (Internal Sequence Generators)
-- ============================================================================
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counters_service_role_all" ON public.counters;
CREATE POLICY "counters_service_role_all" ON public.counters
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner())
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner());


-- ============================================================================
-- 29. SCHEMA MIGRATIONS (Database Version Tracker)
-- ============================================================================
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schema_migrations_service_role_all" ON public.schema_migrations;
CREATE POLICY "schema_migrations_service_role_all" ON public.schema_migrations
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner())
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner());


-- ============================================================================
-- 30. CRON EXECUTION LOGS (Automated Cron Job Auditing)
-- ============================================================================
ALTER TABLE public.cron_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cron_logs_service_role_all" ON public.cron_execution_logs;
CREATE POLICY "cron_logs_service_role_all" ON public.cron_execution_logs
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner())
    WITH CHECK ((auth.jwt() ->> 'role') = 'service_role' OR public.is_admin_or_owner());

-- Record Migration in schema_migrations
INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('016_kotson_security_rls_remediation', NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;
