-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 025
-- SURGICAL FIX FOR ORDERS AND CARTS USER_ID FOREIGN KEY RESOLUTION
-- =============================================================================
-- Root Cause Resolution:
-- 1. orders.user_id has FK constraint orders_user_id_fkey referencing public.users(id).
-- 2. carts.user_id has FK constraint carts_user_id_fkey referencing public.users(id).
-- 3. Supabase Auth callers supply auth.users.id (auth.uid()) or legacy/unmapped user IDs.
-- 4. In kotson_checkout_start_order, p_user_id was inserted directly into public.orders,
--    triggering: insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey".
-- 5. This migration authoritatively resolves auth.users.id -> public.users.id across
--    kotson_checkout_start_order, kotson_checkout_attach_razorpay_order, kotson_get_order_details,
--    kotson_get_or_create_cart, and kotson_cart_merge.
-- 6. If user is guest/unauthenticated/unmapped, user_id safely resolves to NULL (nullable FK).
-- 7. Foreign Key constraint orders_user_id_fkey and carts_user_id_fkey PRESERVED intact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECKOUT START (Authoritative Order Creation & Reservation Attachment)
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
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- 0. Authoritative Identity Resolution for public.users(id) Foreign Key Constraint
    IF p_user_id IS NOT NULL THEN
        -- 1. Direct match on public.users.id
        SELECT id INTO v_target_user_id FROM public.users WHERE id = p_user_id LIMIT 1;
        
        -- 2. Match on public.users.supabase_auth_id (Supabase Auth UID)
        IF v_target_user_id IS NULL THEN
            SELECT id INTO v_target_user_id FROM public.users WHERE supabase_auth_id = p_user_id LIMIT 1;
        END IF;

        -- 3. Linkage match on email via auth.users
        IF v_target_user_id IS NULL THEN
            SELECT pu.id INTO v_target_user_id
            FROM public.users pu
            JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
            WHERE au.id = p_user_id LIMIT 1;

            IF v_target_user_id IS NOT NULL THEN
                UPDATE public.users SET supabase_auth_id = p_user_id WHERE id = v_target_user_id AND supabase_auth_id IS NULL;
            END IF;
        END IF;
    END IF;

    -- 4. Fallback to active JWT auth.uid() if p_user_id was unmapped or NULL
    IF v_target_user_id IS NULL AND v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = v_auth_uid OR supabase_auth_id = v_auth_uid LIMIT 1;
    END IF;

    -- 5. Fallback to shipping address email if provided and matching public.users
    IF v_target_user_id IS NULL AND p_shipping_address IS NOT NULL AND (p_shipping_address->>'email') IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE LOWER(email) = LOWER(p_shipping_address->>'email') LIMIT 1;
    END IF;

    -- 1. Authorize Cart
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found';
    END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF (p_user_id IS NULL AND v_target_user_id IS NULL) 
           OR (v_cart.user_id != p_user_id AND (v_target_user_id IS NULL OR v_cart.user_id != v_target_user_id)) THEN
            IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
                IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied: cart does not belong to customer'; END IF;
            END IF;
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
        v_target_user_id
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

    -- 5. Atomic Stock Reservation (using resolved v_target_user_id)
    v_reservation_res := public.kotson_reserve_inventory(v_cart.id, v_target_user_id, v_pricing->'items', p_ttl_minutes);
    IF NOT (v_reservation_res->>'success')::BOOLEAN THEN
        RAISE EXCEPTION 'Failed to reserve inventory';
    END IF;

    -- 6. Generate Sequential Order Number (KS#####)
    v_order_number := public.kotson_generate_order_number();

    -- Determine customer contacts
    v_user_email := COALESCE(p_shipping_address->>'email', 'guest@kotson.in');
    v_user_phone := p_shipping_address->>'phone';
    v_guest_token := CASE WHEN v_target_user_id IS NULL THEN encode(extensions.gen_random_bytes(24), 'hex') ELSE NULL END;

    v_total_paise := (v_pricing->>'final_total_paise')::BIGINT;
    v_subtotal_paise := (v_pricing->>'subtotal_sale_paise')::BIGINT;
    v_discount_paise := (v_pricing->>'total_referral_discount_paise')::BIGINT + (v_pricing->>'total_coupon_discount_paise')::BIGINT;

    -- 7. Insert Authoritative Order Snapshot with resolved v_target_user_id
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
        v_target_user_id,
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
-- 2. ATTACH RAZORPAY ORDER (Authoritative Identity Resolution)
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
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Authoritative Identity Resolution
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = p_user_id LIMIT 1;
        IF v_target_user_id IS NULL THEN
            SELECT id INTO v_target_user_id FROM public.users WHERE supabase_auth_id = p_user_id LIMIT 1;
        END IF;
        IF v_target_user_id IS NULL THEN
            SELECT pu.id INTO v_target_user_id
            FROM public.users pu
            JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
            WHERE au.id = p_user_id LIMIT 1;
            IF v_target_user_id IS NOT NULL THEN
                UPDATE public.users SET supabase_auth_id = p_user_id WHERE id = v_target_user_id AND supabase_auth_id IS NULL;
            END IF;
        END IF;
    END IF;

    IF v_target_user_id IS NULL AND v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = v_auth_uid OR supabase_auth_id = v_auth_uid LIMIT 1;
    END IF;

    -- Authorize Caller
    IF v_order.user_id IS NOT NULL THEN
        IF (p_user_id IS NULL OR v_order.user_id != p_user_id) 
           AND (v_target_user_id IS NULL OR v_order.user_id != v_target_user_id) THEN
            IF p_guest_access_token IS NULL OR v_order.guest_access_token != p_guest_access_token THEN
                IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
            END IF;
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
-- 3. GET ORDER DETAILS (Authoritative Identity Resolution)
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
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Authoritative Identity Resolution
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = p_user_id LIMIT 1;
        IF v_target_user_id IS NULL THEN
            SELECT id INTO v_target_user_id FROM public.users WHERE supabase_auth_id = p_user_id LIMIT 1;
        END IF;
        IF v_target_user_id IS NULL THEN
            SELECT pu.id INTO v_target_user_id
            FROM public.users pu
            JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
            WHERE au.id = p_user_id LIMIT 1;
            IF v_target_user_id IS NOT NULL THEN
                UPDATE public.users SET supabase_auth_id = p_user_id WHERE id = v_target_user_id AND supabase_auth_id IS NULL;
            END IF;
        END IF;
    END IF;

    IF v_target_user_id IS NULL AND v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = v_auth_uid OR supabase_auth_id = v_auth_uid LIMIT 1;
    END IF;

    -- Validate ownership
    IF v_order.user_id IS NOT NULL THEN
        IF (p_user_id IS NULL OR v_order.user_id != p_user_id)
           AND (v_target_user_id IS NULL OR v_order.user_id != v_target_user_id) THEN
            IF p_guest_access_token IS NULL OR v_order.guest_access_token != p_guest_access_token THEN
                IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
            END IF;
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
        'items', v_order.items,
        'amounts', v_order.amounts,
        'shipping_address', v_order.shipping_address,
        'billing_address', v_order.billing_address,
        'events', v_order.events,
        'paid_at', v_order.paid_at,
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. GET OR CREATE CART (Authoritative Identity Resolution)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_or_create_cart(
    p_token TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart RECORD;
    v_token_hash VARCHAR(64);
    v_new_id UUID := gen_random_uuid();
    v_clean_token TEXT;
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    -- Authoritative Identity Resolution for public.users(id) Foreign Key Constraint
    IF p_user_id IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = p_user_id LIMIT 1;
        IF v_target_user_id IS NULL THEN
            SELECT id INTO v_target_user_id FROM public.users WHERE supabase_auth_id = p_user_id LIMIT 1;
        END IF;
        IF v_target_user_id IS NULL THEN
            SELECT pu.id INTO v_target_user_id
            FROM public.users pu
            JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
            WHERE au.id = p_user_id LIMIT 1;
            IF v_target_user_id IS NOT NULL THEN
                UPDATE public.users SET supabase_auth_id = p_user_id WHERE id = v_target_user_id AND supabase_auth_id IS NULL;
            END IF;
        END IF;
    END IF;

    IF v_target_user_id IS NULL AND v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = v_auth_uid OR supabase_auth_id = v_auth_uid LIMIT 1;
    END IF;

    -- Authenticated User Cart
    IF v_target_user_id IS NOT NULL THEN
        SELECT * INTO v_cart FROM public.carts WHERE user_id = v_target_user_id LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', v_cart.user_id, 'created', false);
        END IF;
        
        -- Check if guest cart exists with p_token to claim it
        IF p_token IS NOT NULL AND TRIM(p_token) != '' THEN
            v_token_hash := public.kotson_hash_token(p_token);
            SELECT * INTO v_cart FROM public.carts WHERE (token_hash = v_token_hash OR token = p_token) AND user_id IS NULL LIMIT 1;
            IF FOUND THEN
                UPDATE public.carts SET user_id = v_target_user_id, updated_at = NOW() WHERE id = v_cart.id;
                RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', v_target_user_id, 'claimed', true);
            END IF;
        END IF;

        -- Create new user cart
        v_clean_token := encode(extensions.gen_random_bytes(32), 'hex');
        INSERT INTO public.carts (id, token, token_hash, user_id, items, created_at, updated_at)
        VALUES (v_new_id, v_clean_token, public.kotson_hash_token(v_clean_token), v_target_user_id, '[]'::JSONB, NOW(), NOW())
        RETURNING * INTO v_cart;
        
        RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', v_cart.user_id, 'created', true);
    END IF;

    -- Guest Cart
    IF p_token IS NOT NULL AND TRIM(p_token) != '' THEN
        v_token_hash := public.kotson_hash_token(p_token);
        SELECT * INTO v_cart FROM public.carts WHERE (token_hash = v_token_hash OR token = p_token) AND user_id IS NULL LIMIT 1;
        IF FOUND THEN
            IF v_cart.token_hash IS NULL THEN
                UPDATE public.carts SET token_hash = v_token_hash WHERE id = v_cart.id;
            END IF;
            RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', NULL, 'created', false);
        END IF;
    END IF;

    -- Create new guest cart with supplied token or opaque random token
    v_clean_token := COALESCE(NULLIF(TRIM(p_token), ''), encode(extensions.gen_random_bytes(32), 'hex'));
    INSERT INTO public.carts (id, token, token_hash, user_id, items, created_at, updated_at)
    VALUES (v_new_id, v_clean_token, public.kotson_hash_token(v_clean_token), NULL, '[]'::JSONB, NOW(), NOW())
    RETURNING * INTO v_cart;
    
    RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', NULL, 'created', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. CART MERGE (Authoritative Identity Resolution)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_cart_merge(
    p_guest_token TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_guest_cart RECORD;
    v_user_cart RECORD;
    v_guest_hash VARCHAR(64);
    v_user_cart_id UUID;
    v_items_map JSONB := '{}'::JSONB;
    v_item JSONB;
    v_var_id TEXT;
    v_qty INT;
    v_variant RECORD;
    v_avail INT;
    v_merged_items JSONB := '[]'::JSONB;
    v_key TEXT;
    v_combined_qty INT;
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required for cart merge';
    END IF;

    -- Authoritative Identity Resolution
    SELECT id INTO v_target_user_id FROM public.users WHERE id = p_user_id LIMIT 1;
    IF v_target_user_id IS NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE supabase_auth_id = p_user_id LIMIT 1;
    END IF;
    IF v_target_user_id IS NULL THEN
        SELECT pu.id INTO v_target_user_id
        FROM public.users pu
        JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
        WHERE au.id = p_user_id LIMIT 1;
        IF v_target_user_id IS NOT NULL THEN
            UPDATE public.users SET supabase_auth_id = p_user_id WHERE id = v_target_user_id AND supabase_auth_id IS NULL;
        END IF;
    END IF;
    IF v_target_user_id IS NULL AND v_auth_uid IS NOT NULL THEN
        SELECT id INTO v_target_user_id FROM public.users WHERE id = v_auth_uid OR supabase_auth_id = v_auth_uid LIMIT 1;
    END IF;

    IF v_target_user_id IS NULL THEN
        -- If cannot resolve user, return gracefully with guest cart
        IF p_guest_token IS NOT NULL THEN
            v_guest_hash := public.kotson_hash_token(p_guest_token);
            SELECT * INTO v_guest_cart FROM public.carts WHERE (token_hash = v_guest_hash OR token = p_guest_token) LIMIT 1;
            IF FOUND THEN
                RETURN jsonb_build_object('id', v_guest_cart.id, 'items', v_guest_cart.items, 'merged', false);
            END IF;
        END IF;
        RETURN jsonb_build_object('merged', false, 'error', 'User not found in system');
    END IF;

    -- Locate or create user cart with resolved v_target_user_id
    SELECT * INTO v_user_cart FROM public.carts WHERE user_id = v_target_user_id FOR UPDATE;
    IF NOT FOUND THEN
        v_user_cart_id := gen_random_uuid();
        INSERT INTO public.carts (id, token, token_hash, user_id, items, created_at, updated_at)
        VALUES (v_user_cart_id, encode(extensions.gen_random_bytes(32), 'hex'), NULL, v_target_user_id, '[]'::JSONB, NOW(), NOW())
        RETURNING * INTO v_user_cart;
    ELSE
        v_user_cart_id := v_user_cart.id;
    END IF;

    -- If guest token was not provided, return user cart as-is
    IF p_guest_token IS NULL OR TRIM(p_guest_token) = '' THEN
        RETURN jsonb_build_object('id', v_user_cart_id, 'items', v_user_cart.items, 'item_count', jsonb_array_length(v_user_cart.items));
    END IF;

    -- Locate guest cart
    v_guest_hash := public.kotson_hash_token(p_guest_token);
    SELECT * INTO v_guest_cart FROM public.carts WHERE (token_hash = v_guest_hash OR token = p_guest_token) AND user_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('id', v_user_cart_id, 'items', v_user_cart.items, 'item_count', jsonb_array_length(v_user_cart.items));
    END IF;

    -- Populate existing user cart items into map
    IF v_user_cart.items IS NOT NULL AND jsonb_array_length(v_user_cart.items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_user_cart.items)
        LOOP
            v_var_id := v_item->>'variant_id';
            v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
            v_items_map := jsonb_set(v_items_map, ARRAY[v_var_id], to_jsonb(v_qty));
        END LOOP;
    END IF;

    -- Add guest cart items into map
    IF v_guest_cart.items IS NOT NULL AND jsonb_array_length(v_guest_cart.items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_guest_cart.items)
        LOOP
            v_var_id := v_item->>'variant_id';
            v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
            IF v_items_map ? v_var_id THEN
                v_combined_qty := (v_items_map->>v_var_id)::INT + v_qty;
                v_items_map := jsonb_set(v_items_map, ARRAY[v_var_id], to_jsonb(v_combined_qty));
            ELSE
                v_items_map := jsonb_set(v_items_map, ARRAY[v_var_id], to_jsonb(v_qty));
            END IF;
        END LOOP;
    END IF;

    -- Validate against real inventory and stock-cap each line
    FOR v_key IN SELECT jsonb_object_keys(v_items_map)
    LOOP
        v_qty := (v_items_map->>v_key)::INT;
        SELECT * INTO v_variant FROM public.product_variants WHERE id = v_key;
        IF FOUND AND v_variant.is_active THEN
            v_avail := GREATEST(0, v_variant.stock - v_variant.reserved);
            IF v_avail > 0 THEN
                v_merged_items := v_merged_items || jsonb_build_object('variant_id', v_key, 'qty', LEAST(v_qty, v_avail));
            END IF;
        END IF;
    END LOOP;

    -- Update user cart with merged items
    UPDATE public.carts
    SET items = v_merged_items,
        updated_at = NOW()
    WHERE id = v_user_cart_id;

    -- Delete old guest cart to prevent duplicate checkouts
    DELETE FROM public.carts WHERE id = v_guest_cart.id;

    RETURN jsonb_build_object(
        'id', v_user_cart_id,
        'items', v_merged_items,
        'item_count', jsonb_array_length(v_merged_items),
        'merged', true
    );
END;
$$;
