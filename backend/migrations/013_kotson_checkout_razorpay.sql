-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 013
-- CHECKOUT & RAZORPAY PAYMENT ORCHESTRATION CORE
-- =============================================================================
-- Architecture & Trust Boundary Documentation:
-- 1. PostgreSQL is the authoritative pricing & order total authority.
-- 2. Client-submitted prices, discounts, subtotals, and totals are ignored.
-- 3. Atomic stock reservation is attached to order at checkout start.
-- 4. Razorpay TEST order amount strictly equals Kotson authoritative total.
-- 5. Payment verification (verify RPC / webhook) validates cryptographic HMAC.
-- 6. Payment success transition (PENDING_PAYMENT -> PAID) is atomic and idempotent.
-- 7. Reservation transition (RESERVED -> CONSUMED) permanently deducts stock.
-- 8. Failed payments do not mark order paid; expired reservations release safely.
-- 9. Processed events table guarantees webhook deduplication and idempotency.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ORDERS TABLE ENHANCEMENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS fulfilment_status VARCHAR(50) NOT NULL DEFAULT 'awaiting_payment',
    ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(50) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS cart_id UUID REFERENCES public.carts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS amounts JSONB,
    ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS guest_access_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_cart_id ON public.orders(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_access_token ON public.orders(guest_access_token);

-- -----------------------------------------------------------------------------
-- 2. PAYMENT ATTEMPTS TABLE (Auditable lineage & safe retry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'created', -- 'created', 'authorized', 'captured', 'failed'
    error_code VARCHAR(100),
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order ON public.payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_rzp_order ON public.payment_attempts(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_rzp_payment ON public.payment_attempts(razorpay_payment_id);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_payment_attempts" ON public.payment_attempts;
CREATE POLICY "service_role_all_payment_attempts" ON public.payment_attempts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR public.is_admin_or_owner());

-- -----------------------------------------------------------------------------
-- 3. PROCESSED EVENTS TABLE (Webhook deduplication & Idempotency)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100),
    payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_eid ON public.processed_events(event_id);
ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_processed_events" ON public.processed_events;
CREATE POLICY "service_role_all_processed_events" ON public.processed_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role' OR public.is_admin_or_owner());

-- -----------------------------------------------------------------------------
-- 4. ORDER NUMBER GENERATION (Atomic sequential KS#####)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_generate_order_number()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seq BIGINT;
    v_num VARCHAR;
BEGIN
    INSERT INTO public.counters (id, seq)
    VALUES ('order_number', 1)
    ON CONFLICT (id) DO UPDATE SET seq = public.counters.seq + 1
    RETURNING seq INTO v_seq;
    
    v_num := 'KS' || LPAD(v_seq::TEXT, 5, '0');
    RETURN v_num;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. CONSUME ORDER RESERVATIONS (RESERVED -> CONSUMED)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_consume_order_reservations(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_res RECORD;
    v_consumed_count INT := 0;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;

    -- Look up all active reservations for this order or cart
    FOR v_res IN 
        SELECT id, variant_id, qty, status
        FROM public.inventory_reservations 
        WHERE (order_id = p_order_id::TEXT OR (cart_id = v_order.cart_id AND status = 'RESERVED'))
        FOR UPDATE
    LOOP
        IF v_res.status = 'RESERVED' THEN
            -- Deduct stock permanently and decrease reserved
            UPDATE public.product_variants
            SET stock = GREATEST(0, stock - v_res.qty),
                reserved = GREATEST(0, reserved - v_res.qty)
            WHERE id = v_res.variant_id;

            -- Record in inventory_ledger
            INSERT INTO public.inventory_ledger (variant_id, delta, reason, reference_id, created_at)
            VALUES (v_res.variant_id, -v_res.qty, 'ORDER_PAID', v_order.order_number, NOW());

            -- Mark reservation CONSUMED
            UPDATE public.inventory_reservations
            SET status = 'CONSUMED',
                order_id = p_order_id::TEXT
            WHERE id = v_res.id;

            v_consumed_count := v_consumed_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'consumed_count', v_consumed_count);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. CHECKOUT START (Authoritative Order Creation & Reservation Attachment)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_checkout_start_order(
    p_cart_id UUID,
    p_token TEXT,
    p_user_id UUID,
    p_shipping_address JSONB,
    p_billing_address JSONB DEFAULT NULL,
    p_referral_code VARCHAR DEFAULT NULL,
    p_coupon_code VARCHAR DEFAULT NULL,
    p_ttl_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_cart RECORD;
    v_token_hash VARCHAR(64);
    v_pricing JSONB;
    v_order_id UUID := gen_random_uuid();
    v_order_number VARCHAR;
    v_reservation_res JSONB;
    v_user_email VARCHAR;
    v_user_phone VARCHAR;
    v_guest_token VARCHAR(255);
    v_total_paise BIGINT;
    v_subtotal_paise BIGINT;
    v_discount_paise BIGINT;
    v_order RECORD;
    v_existing_order RECORD;
BEGIN
    -- 1. Authorize Cart
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found';
    END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied: cart does not belong to customer'; END IF;
        END IF;
    ELSE
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied: invalid guest token for cart'; END IF;
        END IF;
    END IF;

    -- 2. Validate Items
    IF v_cart.items IS NULL OR jsonb_array_length(v_cart.items) = 0 THEN
        RAISE EXCEPTION 'Cart is empty';
    END IF;

    -- 3. Authoritative Pricing Recalculation
    v_pricing := public.kotson_calculate_pricing(
        v_cart.items,
        COALESCE(NULLIF(TRIM(p_referral_code), ''), v_cart.referred_code),
        COALESCE(NULLIF(TRIM(p_coupon_code), ''), v_cart.coupon_code),
        p_user_id
    );

    IF v_pricing->'items' IS NULL OR jsonb_array_length(v_pricing->'items') = 0 THEN
        RAISE EXCEPTION 'No eligible items found in cart';
    END IF;

    -- Validate shipping address
    IF p_shipping_address IS NULL OR (p_shipping_address->>'name') IS NULL OR (p_shipping_address->>'phone') IS NULL THEN
        RAISE EXCEPTION 'Invalid shipping address: recipient name and phone are required';
    END IF;

    -- 4. Check for existing pending order on this cart (Safe retry without duplicating reservations)
    SELECT * INTO v_existing_order 
    FROM public.orders 
    WHERE cart_id = v_cart.id AND payment_status = 'pending' AND status = 'PENDING_PAYMENT'
    ORDER BY created_at DESC LIMIT 1;

    IF FOUND THEN
        -- Check if reservations for this order are still active
        IF EXISTS (SELECT 1 FROM public.inventory_reservations WHERE order_id = v_existing_order.id::TEXT AND status = 'RESERVED' AND expires_at > NOW()) THEN
            -- Lineage preserved: return existing active pending order for safe retry
            RETURN jsonb_build_object(
                'id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'user_id', v_existing_order.user_id,
                'email', v_existing_order.email,
                'phone', v_existing_order.phone,
                'total_paise', v_existing_order.total_paise,
                'subtotal_paise', v_existing_order.subtotal_paise,
                'discount_paise', v_existing_order.discount_paise,
                'currency', 'INR',
                'status', v_existing_order.status,
                'payment_status', v_existing_order.payment_status,
                'razorpay_order_id', v_existing_order.razorpay_order_id,
                'items', v_existing_order.items,
                'amounts', v_existing_order.amounts,
                'guest_access_token', v_existing_order.guest_access_token,
                'is_retry', true
            );
        END IF;
    END IF;

    -- 5. Atomic Stock Reservation
    v_reservation_res := public.kotson_reserve_inventory(v_cart.id, p_user_id, v_pricing->'items', p_ttl_minutes);
    IF NOT (v_reservation_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Failed to reserve inventory';
    END IF;

    -- 6. Generate Sequential Order Number (KS#####)
    v_order_number := public.kotson_generate_order_number();

    -- Determine customer contacts
    v_user_email := COALESCE(p_shipping_address->>'email', 'guest@kotson.in');
    v_user_phone := p_shipping_address->>'phone';
    v_guest_token := CASE WHEN p_user_id IS NULL THEN encode(extensions.gen_random_bytes(24), 'hex') ELSE NULL END;

    v_total_paise := (v_pricing->>'final_total_paise')::BIGINT;
    v_subtotal_paise := (v_pricing->>'subtotal_sale_paise')::BIGINT;
    v_discount_paise := (v_pricing->>'total_referral_discount_paise')::BIGINT + (v_pricing->>'total_coupon_discount_paise')::BIGINT;

    -- 7. Insert Authoritative Order Snapshot
    INSERT INTO public.orders (
        id,
        order_number,
        user_id,
        email,
        phone,
        total_paise,
        subtotal_paise,
        discount_paise,
        referral_code,
        coupon_code,
        status,
        payment_status,
        fulfilment_status,
        reservation_status,
        cart_id,
        shipping_address,
        billing_address,
        items,
        amounts,
        events,
        guest_access_token,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        v_order_number,
        p_user_id,
        v_user_email,
        v_user_phone,
        v_total_paise,
        v_subtotal_paise,
        v_discount_paise,
        v_pricing->>'referral_code',
        v_pricing->>'coupon_code',
        'PENDING_PAYMENT',
        'pending',
        'awaiting_payment',
        'active',
        v_cart.id,
        p_shipping_address,
        COALESCE(p_billing_address, p_shipping_address),
        v_pricing->'items',
        jsonb_build_object(
            'subtotal_mrp_paise', v_pricing->'subtotal_mrp_paise',
            'total_sale_discount_paise', v_pricing->'total_sale_discount_paise',
            'subtotal_sale_paise', v_pricing->'subtotal_sale_paise',
            'total_referral_discount_paise', v_pricing->'total_referral_discount_paise',
            'total_coupon_discount_paise', v_pricing->'total_coupon_discount_paise',
            'total_paise', v_total_paise
        ),
        jsonb_build_array(jsonb_build_object('at', NOW(), 'type', 'order_created', 'detail', 'Order initialized; stock reserved')),
        v_guest_token,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_order;

    -- 8. Attach order_id to the created reservations
    UPDATE public.inventory_reservations
    SET order_id = v_order_id::TEXT
    WHERE cart_id = v_cart.id AND status = 'RESERVED' AND (order_id IS NULL OR order_id = '');

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'user_id', v_order.user_id,
        'email', v_order.email,
        'phone', v_order.phone,
        'total_paise', v_order.total_paise,
        'subtotal_paise', v_order.subtotal_paise,
        'discount_paise', v_order.discount_paise,
        'currency', 'INR',
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'razorpay_order_id', v_order.razorpay_order_id,
        'items', v_order.items,
        'amounts', v_order.amounts,
        'guest_access_token', v_order.guest_access_token,
        'is_retry', false
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. ATTACH RAZORPAY ORDER & RECORD PAYMENT ATTEMPT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_checkout_attach_razorpay_order(
    p_order_id UUID,
    p_razorpay_order_id VARCHAR(100),
    p_user_id UUID DEFAULT NULL,
    p_guest_access_token VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Authorize Caller
    IF v_order.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_order.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF p_guest_access_token IS NULL OR v_order.guest_access_token != p_guest_access_token THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    -- Update order with Razorpay order ID
    UPDATE public.orders
    SET razorpay_order_id = p_razorpay_order_id,
        updated_at = NOW(),
        events = events || jsonb_build_object('at', NOW(), 'type', 'razorpay_order_created', 'razorpay_order_id', p_razorpay_order_id)
    WHERE id = p_order_id;

    -- Record Payment Attempt Lineage
    INSERT INTO public.payment_attempts (
        id, order_id, razorpay_order_id, amount_paise, currency, status, created_at, updated_at
    ) VALUES (
        v_attempt_id, p_order_id, p_razorpay_order_id, v_order.total_paise, 'INR', 'created', NOW(), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'razorpay_order_id', p_razorpay_order_id,
        'attempt_id', v_attempt_id
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. PAYMENT SUCCESS TRANSITION (Guarded, Idempotent, Consumes Reservations)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_payment_success(
    p_order_id UUID DEFAULT NULL,
    p_razorpay_order_id VARCHAR(100) DEFAULT NULL,
    p_razorpay_payment_id VARCHAR(100) DEFAULT NULL,
    p_razorpay_signature VARCHAR(255) DEFAULT NULL,
    p_method VARCHAR(50) DEFAULT 'razorpay',
    p_raw_response JSONB DEFAULT '{}'::JSONB,
    p_source VARCHAR(50) DEFAULT 'verify'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item JSONB;
    v_variant_id VARCHAR(100);
    v_coupon RECORD;
BEGIN
    IF p_order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    ELSIF p_razorpay_order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM public.orders WHERE razorpay_order_id = p_razorpay_order_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Neither order_id nor razorpay_order_id provided';
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Matching order not found';
    END IF;

    -- IDEMPOTENCY GUARD: Whichever signal (verify or webhook) arrives first marks PAID; second is no-op
    IF v_order.payment_status = 'paid' OR v_order.status = 'PAID' THEN
        RETURN jsonb_build_object(
            'status', 'already_paid',
            'order_id', v_order.id,
            'order_number', v_order.order_number,
            'idempotent', true,
            'message', 'Order is already marked as paid'
        );
    END IF;

    -- 1. Mark Order PAID
    UPDATE public.orders
    SET status = 'PAID',
        payment_status = 'paid',
        fulfilment_status = 'processing',
        reservation_status = 'consumed',
        razorpay_payment_id = COALESCE(p_razorpay_payment_id, razorpay_payment_id),
        razorpay_signature = COALESCE(p_razorpay_signature, razorpay_signature),
        paid_at = NOW(),
        updated_at = NOW(),
        events = events || jsonb_build_object(
            'at', NOW(),
            'type', 'payment_success',
            'source', p_source,
            'payment_id', p_razorpay_payment_id,
            'method', p_method
        )
    WHERE id = v_order.id;

    -- 2. Consume Stock Reservation (RESERVED -> CONSUMED)
    PERFORM public.kotson_consume_order_reservations(v_order.id);

    -- 3. Record in Payments Table (Idempotent ON CONFLICT)
    IF p_razorpay_payment_id IS NOT NULL THEN
        INSERT INTO public.payments (
            order_id,
            order_number,
            razorpay_order_id,
            razorpay_payment_id,
            amount_paise,
            currency,
            status,
            method,
            raw_response,
            created_at
        ) VALUES (
            v_order.id,
            v_order.order_number,
            COALESCE(p_razorpay_order_id, v_order.razorpay_order_id),
            p_razorpay_payment_id,
            v_order.total_paise,
            'INR',
            'captured',
            p_method,
            p_raw_response,
            NOW()
        )
        ON CONFLICT (razorpay_payment_id) DO NOTHING;

        -- 4. Update Payment Attempt
        UPDATE public.payment_attempts
        SET status = 'captured',
            razorpay_payment_id = p_razorpay_payment_id,
            updated_at = NOW()
        WHERE order_id = v_order.id 
          AND (razorpay_order_id = COALESCE(p_razorpay_order_id, v_order.razorpay_order_id) OR razorpay_order_id IS NULL);
    END IF;

    -- 5. Record Coupon Usage
    IF v_order.coupon_code IS NOT NULL THEN
        SELECT * INTO v_coupon FROM public.coupons WHERE code = v_order.coupon_code;
        IF FOUND THEN
            UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;
            INSERT INTO public.coupon_usages (coupon_id, user_id, order_id, used_at)
            VALUES (v_coupon.id, v_order.user_id, v_order.id, NOW());
        END IF;
    END IF;

    -- 6. Clear Purchased Items from Cart
    IF v_order.cart_id IS NOT NULL THEN
        UPDATE public.carts SET items = '[]'::JSONB, coupon_code = NULL, updated_at = NOW() WHERE id = v_order.cart_id;
    END IF;

    RETURN jsonb_build_object(
        'status', 'paid',
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'idempotent', false
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. PAYMENT FAILURE TRANSITION (Order preserved, reservation not consumed)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_payment_failed(
    p_razorpay_order_id VARCHAR(100),
    p_error_code VARCHAR(100) DEFAULT NULL,
    p_error_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE razorpay_order_id = p_razorpay_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- NEVER revert a paid order to failed!
    IF v_order.payment_status = 'paid' OR v_order.status = 'PAID' THEN
        RETURN jsonb_build_object('success', true, 'status', 'already_paid', 'message', 'Order is already paid; failed signal ignored');
    END IF;

    -- Mark Order PAYMENT_FAILED
    UPDATE public.orders
    SET status = 'PAYMENT_FAILED',
        payment_status = 'failed',
        updated_at = NOW(),
        events = events || jsonb_build_object(
            'at', NOW(),
            'type', 'payment_failed',
            'code', p_error_code,
            'detail', p_error_description
        )
    WHERE id = v_order.id;

    -- Update Payment Attempt
    UPDATE public.payment_attempts
    SET status = 'failed',
        error_code = p_error_code,
        error_description = p_error_description,
        updated_at = NOW()
    WHERE razorpay_order_id = p_razorpay_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'failed',
        'order_id', v_order.id,
        'order_number', v_order.order_number
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. WEBHOOK DEDUPLICATION RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_record_webhook_event(
    p_event_id VARCHAR(255),
    p_event_type VARCHAR(100),
    p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.processed_events WHERE event_id = p_event_id) THEN
        RETURN jsonb_build_object('processed', true, 'deduplicated', true);
    END IF;

    INSERT INTO public.processed_events (event_id, event_type, payload, created_at)
    VALUES (p_event_id, p_event_type, p_payload, NOW())
    ON CONFLICT (event_id) DO NOTHING;

    RETURN jsonb_build_object('processed', true, 'deduplicated', false);
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. GET ORDER DETAILS (Protected against cross-user access)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_order_details(
    p_order_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_guest_access_token VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Validate ownership
    IF v_order.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_order.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF p_guest_access_token IS NULL OR v_order.guest_access_token != p_guest_access_token THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'user_id', v_order.user_id,
        'email', v_order.email,
        'phone', v_order.phone,
        'total_paise', v_order.total_paise,
        'subtotal_paise', v_order.subtotal_paise,
        'discount_paise', v_order.discount_paise,
        'currency', 'INR',
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'fulfilment_status', v_order.fulfilment_status,
        'reservation_status', v_order.reservation_status,
        'razorpay_order_id', v_order.razorpay_order_id,
        'razorpay_payment_id', v_order.razorpay_payment_id,
        'shipping_address', v_order.shipping_address,
        'items', v_order.items,
        'amounts', v_order.amounts,
        'created_at', v_order.created_at,
        'paid_at', v_order.paid_at
    );
END;
$$;
