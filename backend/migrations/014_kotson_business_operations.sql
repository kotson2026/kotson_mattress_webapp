-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 014
-- BUSINESS OPERATIONS: REFERRAL COMMISSIONS, WALLETS, CUSTOM REQUESTS,
-- CRM ISOLATION, DEALERS, WORKFORCE, DISPATCH & RETURNS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. IMMUTABLE AUDIT LOG TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL) 
       AND OLD.action = NEW.action AND OLD.entity_type = NEW.entity_type 
       AND OLD.entity_id = NEW.entity_id AND OLD.created_at = NEW.created_at THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Audit logs are immutable and append-only.';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- -----------------------------------------------------------------------------
-- 2. CRM LEAD ASSIGNMENT HISTORY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_lead_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    previous_employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    new_employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reassigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'REASSIGNMENT',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_hist_lead ON public.crm_lead_history(lead_id);
ALTER TABLE public.crm_lead_history ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. REFERRAL COMMISSION & WALLET RPCS
-- -----------------------------------------------------------------------------

-- Create referral commission strictly on PAID orders (Idempotent)
CREATE OR REPLACE FUNCTION public.kotson_record_referral_commission(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_referrer RECORD;
    v_existing_reward RECORD;
    v_commission_paise BIGINT;
    v_rate NUMERIC(10, 2) := 5.0; -- Standard 5% referral commission
    v_reward_id UUID := gen_random_uuid();
    v_cur_balance BIGINT;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Strict Invariant: Commission eligible ONLY on PAID orders
    IF v_order.status != 'PAID' OR v_order.payment_status != 'paid' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'order_not_paid', 'message', 'Commission eligible only on paid orders');
    END IF;

    IF v_order.referral_code IS NULL OR TRIM(v_order.referral_code) = '' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'no_referral_code');
    END IF;

    -- Idempotency check: Already recorded?
    SELECT * INTO v_existing_reward FROM public.referral_rewards WHERE order_id = p_order_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'reward_id', v_existing_reward.id,
            'amount_paise', v_existing_reward.amount_paise,
            'message', 'Referral commission already recorded for this order'
        );
    END IF;

    -- Look up referrer
    SELECT * INTO v_referrer FROM public.users WHERE UPPER(referral_code) = UPPER(TRIM(v_order.referral_code)) AND is_active = TRUE LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'referrer_not_found');
    END IF;

    -- Invariant: Self-referral strictly prohibited
    IF v_referrer.id = v_order.user_id THEN
        RAISE EXCEPTION 'Self-referral prohibited: customer cannot earn commission on own order';
    END IF;

    -- Compute 5% commission of subtotal_paise (integer paise)
    v_commission_paise := ROUND(v_order.subtotal_paise * (v_rate / 100.0))::BIGINT;
    IF v_commission_paise <= 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'zero_commission');
    END IF;

    -- Insert Referral Reward
    INSERT INTO public.referral_rewards (
        id, user_id, order_id, code, order_number, amount_paise, rate_applied, status, created_at, updated_at
    ) VALUES (
        v_reward_id, v_referrer.id, v_order.id, v_order.referral_code, v_order.order_number,
        v_commission_paise, v_rate, 'AVAILABLE_FOR_WITHDRAWAL', NOW(), NOW()
    );

    -- Get current wallet balance
    SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_paise ELSE -amount_paise END), 0)
    INTO v_cur_balance
    FROM public.wallet_ledger WHERE user_id = v_referrer.id;

    -- Credit Wallet Ledger
    INSERT INTO public.wallet_ledger (
        user_id, type, amount_paise, balance_paise, description, reference_id, created_at
    ) VALUES (
        v_referrer.id, 'CREDIT', v_commission_paise, v_cur_balance + v_commission_paise,
        'Referral commission for order ' || v_order.order_number, v_reward_id, NOW()
    );

    -- Audit Log
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (v_referrer.id, 'referral.commission_credited', 'order', v_order.id::TEXT,
            jsonb_build_object('order_number', v_order.order_number, 'amount_paise', v_commission_paise));

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'reward_id', v_reward_id,
        'amount_paise', v_commission_paise,
        'referrer_id', v_referrer.id
    );
END;
$$;

-- Authoritative Wallet Balance
CREATE OR REPLACE FUNCTION public.kotson_get_wallet_balance(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_paise ELSE -amount_paise END), 0)
    INTO v_balance
    FROM public.wallet_ledger
    WHERE user_id = p_user_id;

    RETURN GREATEST(0, v_balance);
END;
$$;

-- Request Withdrawal (Concurrency-safe with row lock)
CREATE OR REPLACE FUNCTION public.kotson_request_referral_withdrawal(
    p_user_id UUID,
    p_amount_paise BIGINT,
    p_pan_masked VARCHAR DEFAULT 'XXXXX1234X',
    p_bank_masked VARCHAR DEFAULT 'XXXXXXXX1234'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_avail_balance BIGINT;
    v_tds_paise BIGINT;
    v_net_payout BIGINT;
    v_w_id UUID := gen_random_uuid();
BEGIN
    IF p_amount_paise <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
    END IF;

    -- Concurrency row lock on user
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_avail_balance := public.kotson_get_wallet_balance(p_user_id);
    IF p_amount_paise > v_avail_balance THEN
        RAISE EXCEPTION 'Insufficient withdrawable balance: requested % paise but available % paise', p_amount_paise, v_avail_balance;
    END IF;

    -- 5% TDS withholding
    v_tds_paise := ROUND(p_amount_paise * 0.05)::BIGINT;
    v_net_payout := p_amount_paise - v_tds_paise;

    INSERT INTO public.referral_withdrawals (
        id, user_id, amount_paise, tds_rate, tds_paise, net_payout_paise,
        pan_masked, bank_masked, status, created_at, updated_at
    ) VALUES (
        v_w_id, p_user_id, p_amount_paise, 5.0, v_tds_paise, v_net_payout,
        p_pan_masked, p_bank_masked, 'REQUESTED', NOW(), NOW()
    );

    -- Debit wallet ledger immediately to prevent double spending
    INSERT INTO public.wallet_ledger (
        user_id, type, amount_paise, balance_paise, description, reference_id, created_at
    ) VALUES (
        p_user_id, 'DEBIT', p_amount_paise, v_avail_balance - p_amount_paise,
        'Withdrawal request ' || v_w_id::TEXT, v_w_id, NOW()
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_user_id, 'referral.withdrawal_requested', 'withdrawal', v_w_id::TEXT,
            jsonb_build_object('amount_paise', p_amount_paise, 'net_payout_paise', v_net_payout));

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_w_id,
        'amount_paise', p_amount_paise,
        'net_payout_paise', v_net_payout,
        'remaining_balance_paise', v_avail_balance - p_amount_paise
    );
END;
$$;

-- Approve Withdrawal (Admin/Owner only)
CREATE OR REPLACE FUNCTION public.kotson_approve_referral_withdrawal(
    p_withdrawal_id UUID,
    p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin RECORD;
    v_w RECORD;
BEGIN
    SELECT * INTO v_admin FROM public.users WHERE id = p_admin_user_id;
    IF NOT FOUND OR NOT (v_admin.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can approve withdrawals';
    END IF;

    SELECT * INTO v_w FROM public.referral_withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;

    UPDATE public.referral_withdrawals
    SET status = 'APPROVED', updated_at = NOW()
    WHERE id = p_withdrawal_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_admin_user_id, 'referral.withdrawal_approved', 'withdrawal', p_withdrawal_id::TEXT,
            jsonb_build_object('amount_paise', v_w.amount_paise, 'approved_by', v_admin.email));

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED');
END;
$$;

-- Reverse Referral Commission (Idempotent)
CREATE OR REPLACE FUNCTION public.kotson_reverse_referral_commission(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Order refunded or returned'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward RECORD;
    v_cur_balance BIGINT;
BEGIN
    SELECT * INTO v_reward FROM public.referral_rewards WHERE order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No commission record found for order');
    END IF;

    -- Idempotency check: Already reversed?
    IF v_reward.status = 'REVERSED' THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Commission is already reversed');
    END IF;

    UPDATE public.referral_rewards
    SET status = 'REVERSED', updated_at = NOW()
    WHERE id = v_reward.id;

    v_cur_balance := public.kotson_get_wallet_balance(v_reward.user_id);

    -- Debit ledger to reverse credit
    INSERT INTO public.wallet_ledger (
        user_id, type, amount_paise, balance_paise, description, reference_id, created_at
    ) VALUES (
        v_reward.user_id, 'DEBIT', v_reward.amount_paise, GREATEST(0, v_cur_balance - v_reward.amount_paise),
        'Reversal: ' || p_reason, v_reward.id, NOW()
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (v_reward.user_id, 'referral.commission_reversed', 'reward', v_reward.id::TEXT,
            jsonb_build_object('order_id', p_order_id, 'amount_paise', v_reward.amount_paise, 'reason', p_reason));

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'reward_id', v_reward.id,
        'reversed_amount_paise', v_reward.amount_paise
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. CUSTOM PRODUCT REQUESTS (KT-CUSTOM-##### Sequence & Dimension Validation)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kotson_generate_custom_request_number()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seq BIGINT;
BEGIN
    INSERT INTO public.counters (id, seq)
    VALUES ('custom_request_number', 1)
    ON CONFLICT (id) DO UPDATE SET seq = public.counters.seq + 1
    RETURNING seq INTO v_seq;

    RETURN 'KT-CUSTOM-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.kotson_create_custom_request(
    p_customer_name VARCHAR,
    p_mobile VARCHAR,
    p_email VARCHAR,
    p_city VARCHAR,
    p_pincode VARCHAR,
    p_product_id VARCHAR,
    p_product_name VARCHAR,
    p_length NUMERIC,
    p_breadth NUMERIC,
    p_thickness NUMERIC,
    p_customer_id UUID DEFAULT NULL,
    p_customer_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req_num VARCHAR;
    v_req_id VARCHAR(100);
BEGIN
    -- Server-side dimension validation against standard mattress configuration limits
    IF p_length < 48 OR p_length > 96 THEN
        RAISE EXCEPTION 'Invalid dimensions: length must be between 48 and 96 inches';
    END IF;

    IF p_breadth < 24 OR p_breadth > 84 THEN
        RAISE EXCEPTION 'Invalid dimensions: breadth must be between 24 and 84 inches';
    END IF;

    IF p_thickness < 2 OR p_thickness > 16 THEN
        RAISE EXCEPTION 'Invalid dimensions: thickness must be between 2 and 16 inches';
    END IF;

    IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' OR p_mobile IS NULL OR TRIM(p_mobile) = '' THEN
        RAISE EXCEPTION 'Customer name and mobile number are required';
    END IF;

    v_req_num := public.kotson_generate_custom_request_number();
    v_req_id := 'cr_' || gen_random_uuid()::TEXT;

    -- Client cannot set quoted_price or status; forced to NEW and NULL quote
    INSERT INTO public.custom_product_requests (
        id, request_number, customer_id, customer_name, mobile, email, city, pincode,
        product_id, product_name_snapshot, length, breadth, height_or_thickness,
        status, customer_remarks, quoted_price, created_at, updated_at
    ) VALUES (
        v_req_id, v_req_num, p_customer_id, p_customer_name, p_mobile, p_email, p_city, p_pincode,
        p_product_id, p_product_name, p_length::TEXT, p_breadth::TEXT, p_thickness::TEXT,
        'NEW', p_customer_remarks, NULL, NOW(), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'request_number', v_req_num,
        'status', 'NEW',
        'length', p_length,
        'breadth', p_breadth,
        'thickness', p_thickness
    );
END;
$$;

-- Manager/Admin sets Quote
CREATE OR REPLACE FUNCTION public.kotson_update_custom_request_quote(
    p_request_id VARCHAR,
    p_staff_user_id UUID,
    p_quoted_price NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff RECORD;
    v_req RECORD;
BEGIN
    SELECT * INTO v_staff FROM public.users WHERE id = p_staff_user_id;
    IF NOT FOUND OR NOT (v_staff.roles && ARRAY['owner', 'admin', 'manager']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only manager, admin, or owner can quote custom requests';
    END IF;

    SELECT * INTO v_req FROM public.custom_product_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Custom request not found';
    END IF;

    UPDATE public.custom_product_requests
    SET quoted_price = p_quoted_price,
        quote_notes = p_notes,
        quote_date = NOW(),
        status = 'QUOTED',
        assigned_to_user_id = p_staff_user_id,
        assigned_to_name = v_staff.name,
        updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_staff_user_id, 'custom_request.quoted', 'custom_request', p_request_id,
            jsonb_build_object('quoted_price', p_quoted_price, 'notes', p_notes));

    RETURN jsonb_build_object(
        'success', true,
        'request_id', p_request_id,
        'status', 'QUOTED',
        'quoted_price', p_quoted_price
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. CRM REASSIGNMENT & PROGRESSION INVARIANTS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kotson_reassign_crm_lead(
    p_lead_id UUID,
    p_new_employee_id UUID,
    p_reassigned_by UUID,
    p_reason TEXT DEFAULT 'Lead reassignment'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead RECORD;
    v_staff RECORD;
    v_old_emp_id UUID;
BEGIN
    SELECT * INTO v_staff FROM public.users WHERE id = p_reassigned_by;
    IF NOT FOUND OR NOT (v_staff.roles && ARRAY['owner', 'admin', 'manager', 'crm_master', 'crm_manager']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: unauthorized to reassign leads';
    END IF;

    SELECT * INTO v_lead FROM public.crm_leads WHERE id = p_lead_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_old_emp_id := v_lead.employee_id;

    -- Update lead employee
    UPDATE public.crm_leads
    SET employee_id = p_new_employee_id, updated_at = NOW()
    WHERE id = p_lead_id;

    -- Invariant: Record reassignment history
    INSERT INTO public.crm_lead_history (
        lead_id, previous_employee_id, new_employee_id, reassigned_by, action, reason, created_at
    ) VALUES (
        p_lead_id, v_old_emp_id, p_new_employee_id, p_reassigned_by, 'REASSIGNMENT', p_reason, NOW()
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_reassigned_by, 'crm.lead_reassigned', 'crm_lead', p_lead_id::TEXT,
            jsonb_build_object('from', v_old_emp_id, 'to', p_new_employee_id, 'reason', p_reason));

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'previous_employee_id', v_old_emp_id,
        'new_employee_id', p_new_employee_id
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. WORKFORCE ATTENDANCE & PAYROLL INTEGRITY
-- -----------------------------------------------------------------------------

-- Clock In with duplicate protection
CREATE OR REPLACE FUNCTION public.kotson_clock_in(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_date VARCHAR(20) := CURRENT_DATE::TEXT;
    v_active RECORD;
    v_session_id UUID := gen_random_uuid();
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found';
    END IF;

    -- Invariant: Prevent duplicate active clock-in
    SELECT * INTO v_active FROM public.attendance_sessions
    WHERE employee_id = p_employee_id AND date = v_date AND clock_out_at IS NULL;

    IF FOUND THEN
        RAISE EXCEPTION 'Duplicate clock-in blocked: an active attendance session already exists today';
    END IF;

    INSERT INTO public.attendance_sessions (
        id, employee_id, employee_name, employee_email, date, clock_in_at, status, created_at, updated_at
    ) VALUES (
        v_session_id, p_employee_id, v_user.name, v_user.email, v_date, NOW(), 'present', NOW(), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'clock_in_at', NOW(),
        'date', v_date
    );
END;
$$;

-- Clock Out with validation
CREATE OR REPLACE FUNCTION public.kotson_clock_out(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date VARCHAR(20) := CURRENT_DATE::TEXT;
    v_session RECORD;
    v_gross_min NUMERIC(8, 2);
BEGIN
    SELECT * INTO v_session FROM public.attendance_sessions
    WHERE employee_id = p_employee_id AND date = v_date AND clock_out_at IS NULL
    ORDER BY clock_in_at DESC LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid clock-out: no active clock-in session found today';
    END IF;

    v_gross_min := ROUND(EXTRACT(EPOCH FROM (NOW() - v_session.clock_in_at)) / 60.0, 2);

    UPDATE public.attendance_sessions
    SET clock_out_at = NOW(),
        gross_minutes = v_gross_min,
        net_minutes = v_gross_min,
        updated_at = NOW()
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'clock_out_at', NOW(),
        'gross_minutes', v_gross_min
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. DISPATCH & RETURNS WORKFLOWS
-- -----------------------------------------------------------------------------

-- Create Shipment (Strict invariant: only PAID orders can be dispatched)
CREATE OR REPLACE FUNCTION public.kotson_create_shipment(
    p_order_id UUID,
    p_carrier VARCHAR,
    p_awb VARCHAR,
    p_shipment_items JSONB,
    p_dispatched_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_shipment_id UUID := gen_random_uuid();
    v_shipment_num VARCHAR;
    v_seq BIGINT;
    v_s_item JSONB;
    v_o_item JSONB;
    v_found_match BOOLEAN;
    v_ordered_qty INT;
    v_ship_qty INT;
    v_var_id VARCHAR;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Strict Invariant: Unpaid orders cannot enter dispatch
    IF v_order.status != 'PAID' OR v_order.payment_status != 'paid' THEN
        RAISE EXCEPTION 'Cannot dispatch unpaid order % (status: %, payment_status: %)',
            v_order.order_number, v_order.status, v_order.payment_status;
    END IF;

    -- Invariant: Prevent over-shipping
    FOR v_s_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_shipment_items, '[]'::JSONB))
    LOOP
        v_var_id := v_s_item->>'variant_id';
        v_ship_qty := (v_s_item->>'qty')::INT;
        v_found_match := FALSE;

        FOR v_o_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            IF (v_o_item->>'variant_id') = v_var_id THEN
                v_ordered_qty := COALESCE((v_o_item->>'qty')::INT, (v_o_item->>'quantity')::INT, 1);
                v_found_match := TRUE;
                IF v_ship_qty > v_ordered_qty THEN
                    RAISE EXCEPTION 'Over-shipping blocked: variant % shipment qty % exceeds ordered qty %',
                        v_var_id, v_ship_qty, v_ordered_qty;
                END IF;
            END IF;
        END LOOP;

        IF NOT v_found_match THEN
            RAISE EXCEPTION 'Variant % is not in order %', v_var_id, v_order.order_number;
        END IF;
    END LOOP;

    -- Sequential shipment number
    INSERT INTO public.counters (id, seq) VALUES ('shipment_number', 1)
    ON CONFLICT (id) DO UPDATE SET seq = public.counters.seq + 1
    RETURNING seq INTO v_seq;
    v_shipment_num := 'SHP-' || LPAD(v_seq::TEXT, 5, '0');

    INSERT INTO public.shipments (
        id, shipment_number, order_id, order_number, carrier, awb_number,
        status, shipping_address, items, dispatched_at, created_at, updated_at
    ) VALUES (
        v_shipment_id, v_shipment_num, v_order.id, v_order.order_number, p_carrier, p_awb,
        'DISPATCHED', v_order.shipping_address, p_shipment_items, NOW(), NOW(), NOW()
    );

    UPDATE public.orders
    SET fulfilment_status = 'dispatched', updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_dispatched_by, 'dispatch.shipment_created', 'shipment', v_shipment_id::TEXT,
            jsonb_build_object('order_number', v_order.order_number, 'shipment_number', v_shipment_num, 'awb', p_awb));

    RETURN jsonb_build_object(
        'success', true,
        'shipment_id', v_shipment_id,
        'shipment_number', v_shipment_num,
        'status', 'DISPATCHED'
    );
END;
$$;

-- Approve Return & Restock (Restock executes exactly once)
CREATE OR REPLACE FUNCTION public.kotson_approve_return(
    p_return_id UUID,
    p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_staff RECORD;
    v_return RECORD;
    v_item JSONB;
    v_var_id VARCHAR;
    v_qty INT;
BEGIN
    SELECT * INTO v_staff FROM public.users WHERE id = p_reviewer_id;
    IF NOT FOUND OR NOT (v_staff.roles && ARRAY['owner', 'admin', 'manager']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: customer or unauthorized user cannot approve returns';
    END IF;

    SELECT * INTO v_return FROM public.return_requests WHERE id = p_return_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;

    -- Invariant: Restock happens exactly once
    IF v_return.restocked = TRUE THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'return_id', p_return_id,
            'status', v_return.status,
            'message', 'Return request is already approved and restocked'
        );
    END IF;

    -- Restock returned units into product_variants
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_return.items, '[]'::JSONB))
    LOOP
        v_var_id := v_item->>'variant_id';
        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1));

        UPDATE public.product_variants
        SET stock = stock + v_qty
        WHERE id = v_var_id;

        INSERT INTO public.inventory_ledger (
            variant_id, delta, reason, reference_id, created_at
        ) VALUES (
            v_var_id, v_qty, 'RETURN_RESTOCK', v_return.request_number, NOW()
        );
    END LOOP;

    UPDATE public.return_requests
    SET status = 'approved',
        restocked = TRUE,
        updated_at = NOW(),
        trail = trail || jsonb_build_object('at', NOW(), 'action', 'approved_and_restocked', 'by', v_staff.email)
    WHERE id = p_return_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_reviewer_id, 'return.approved', 'return_request', p_return_id::TEXT,
            jsonb_build_object('request_number', v_return.request_number, 'restocked', true));

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'return_id', p_return_id,
        'status', 'approved',
        'restocked', true
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. OWNER ADMIN DASHBOARD METRICS RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_owner_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_paid_orders BIGINT;
    v_total_gross_paise BIGINT;
    v_total_mattress_orders BIGINT;
    v_total_pillow_orders BIGINT;
    v_total_topper_orders BIGINT;
    v_total_signups BIGINT;
    v_unique_purchasers BIGINT;
    v_total_dealers BIGINT;
    v_pending_dealers BIGINT;
    v_low_stock_count BIGINT;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(total_paise), 0)
    INTO v_total_paid_orders, v_total_gross_paise
    FROM public.orders
    WHERE status = 'PAID' OR payment_status = 'paid';

    SELECT COUNT(DISTINCT user_id)
    INTO v_unique_purchasers
    FROM public.orders
    WHERE (status = 'PAID' OR payment_status = 'paid') AND user_id IS NOT NULL;

    SELECT COUNT(*) INTO v_total_signups FROM public.users WHERE 'customer' = ANY(roles);

    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pending')
    INTO v_total_dealers, v_pending_dealers
    FROM public.dealers;

    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM public.product_variants
    WHERE (stock - reserved) <= 5 AND is_active = TRUE;

    RETURN jsonb_build_object(
        'total_paid_orders', v_total_paid_orders,
        'gross_revenue_paise', v_total_gross_paise,
        'unique_purchasers', v_unique_purchasers,
        'total_signups', v_total_signups,
        'total_dealers', v_total_dealers,
        'pending_dealers', v_pending_dealers,
        'low_stock_count', v_low_stock_count,
        'aov_paise', CASE WHEN v_total_paid_orders > 0 THEN v_total_gross_paise / v_total_paid_orders ELSE 0 END
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. PRODUCTION-GRADE RLS SECURITY POLICIES FOR OPERATIONAL DOMAINS
-- -----------------------------------------------------------------------------

-- --- crm_leads ---
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_view_crm_leads" ON public.crm_leads;
CREATE POLICY "staff_view_crm_leads" ON public.crm_leads
    FOR SELECT USING (
        public.is_admin_or_owner()
        OR (manager_id = auth.uid() AND auth.jwt() ->> 'role' = 'authenticated')
        OR (employee_id = auth.uid() AND auth.jwt() ->> 'role' = 'authenticated')
    );

-- --- dealers ---
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealer_select_own_profile" ON public.dealers;
CREATE POLICY "dealer_select_own_profile" ON public.dealers
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

-- --- salary_structures ---
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_view_own_salary" ON public.salary_structures;
CREATE POLICY "employee_view_own_salary" ON public.salary_structures
    FOR SELECT USING (
        employee_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

-- Block employee updates to salary
DROP POLICY IF EXISTS "admin_manage_salaries" ON public.salary_structures;
CREATE POLICY "admin_manage_salaries" ON public.salary_structures
    FOR ALL USING (public.is_admin_or_owner());

-- --- referral_rewards & wallet_ledger ---
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_view_own_rewards" ON public.referral_rewards;
CREATE POLICY "customer_view_own_rewards" ON public.referral_rewards
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_view_own_wallet_ledger" ON public.wallet_ledger;
CREATE POLICY "customer_view_own_wallet_ledger" ON public.wallet_ledger
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

-- -----------------------------------------------------------------------------
-- 10. ROLE MODIFICATION & DEALER APPROVAL RPCs (Privilege Escalation Protection)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_approve_dealer(
    p_dealer_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_dealer RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can approve dealers';
    END IF;

    SELECT * INTO v_dealer FROM public.dealers 
    WHERE id = p_dealer_id OR user_id = p_dealer_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dealer not found';
    END IF;

    UPDATE public.dealers SET status = 'approved', updated_at = NOW() WHERE id = v_dealer.id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'dealer.approved', 'dealer', v_dealer.id::TEXT,
            jsonb_build_object('org_name', v_dealer.org_name, 'approved_by', v_actor.email));

    RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.kotson_update_user_role(
    p_target_user_id UUID,
    p_new_roles TEXT[],
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can modify user roles';
    END IF;

    UPDATE public.users SET roles = p_new_roles, updated_at = NOW() WHERE id = p_target_user_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'user.role_changed', 'user', p_target_user_id::TEXT,
            jsonb_build_object('new_roles', p_new_roles, 'updated_by', v_actor.email));

    RETURN jsonb_build_object('success', true, 'new_roles', p_new_roles);
END;
$$;

-- Allow user cleanup without breaking immutable audit trail
ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

