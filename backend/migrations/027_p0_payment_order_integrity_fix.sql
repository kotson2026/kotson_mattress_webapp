-- ============================================================================
-- MIGRATION 027: P0 PAYMENT <-> ORDER INTEGRITY REMEDIATION
-- Resolves root cause:
-- 1. kotson_snapshot_order_attribution referenced non-existent v_order.total_amount
--    instead of (v_order.total_paise::NUMERIC / 100.0), causing kotson_payment_success
--    to rollback across both checkout-verify and razorpay-webhook.
-- 2. kotson_consume_order_reservations updated to allow consuming reservations in
--    RESERVED or EXPIRED status when gateway payment is verified, guaranteeing stock
--    deduction and marking status = 'CONSUMED'.
-- 3. kotson_create_order_from_cart updated to ensure both paise and standardized
--    subtotal/discount/total and item qty/line_total/unit_price fields are snapshotted.
-- ============================================================================

-- 1. FIX kotson_snapshot_order_attribution
CREATE OR REPLACE FUNCTION public.kotson_snapshot_order_attribution(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_attr RECORD;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'order_not_found');
    END IF;

    IF v_order.user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'guest_order_no_user');
    END IF;

    -- Ensure customer attribution exists
    PERFORM public.kotson_sync_customer_attribution(v_order.user_id);

    SELECT * INTO v_attr FROM public.customer_attribution WHERE user_id = v_order.user_id;

    INSERT INTO public.order_attribution (
        order_id, user_id,
        first_touch_link_id, first_touch_campaign_id, first_touch_source, first_touch_medium, first_touch_campaign,
        last_touch_link_id, last_touch_campaign_id, last_touch_source, last_touch_medium, last_touch_campaign,
        order_amount, status, created_at
    ) VALUES (
        v_order.id, v_order.user_id,
        v_attr.first_touch_link_id, v_attr.first_touch_campaign_id, COALESCE(v_attr.first_touch_source, 'Direct / Organic'), COALESCE(v_attr.first_touch_medium, 'direct'), COALESCE(v_attr.first_touch_campaign, 'none'),
        v_attr.last_touch_link_id, v_attr.last_touch_campaign_id, COALESCE(v_attr.last_touch_source, 'Direct / Organic'), COALESCE(v_attr.last_touch_medium, 'direct'), COALESCE(v_attr.last_touch_campaign, 'none'),
        (COALESCE(v_order.total_paise, 0)::NUMERIC / 100.0), 'PAID', NOW()
    )
    ON CONFLICT (order_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- 2. FIX kotson_consume_order_reservations
CREATE OR REPLACE FUNCTION public.kotson_consume_order_reservations(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

    -- Look up all reservations for this order or cart
    FOR v_res IN 
        SELECT id, variant_id, qty, status
        FROM public.inventory_reservations 
        WHERE (order_id = p_order_id::TEXT OR (cart_id = v_order.cart_id AND status IN ('RESERVED', 'EXPIRED')))
        FOR UPDATE
    LOOP
        IF v_res.status IN ('RESERVED', 'EXPIRED') THEN
            -- Deduct stock permanently and decrease reserved if was reserved
            UPDATE public.product_variants
            SET stock = GREATEST(0, stock - v_res.qty),
                reserved = CASE WHEN v_res.status = 'RESERVED' THEN GREATEST(0, reserved - v_res.qty) ELSE reserved END
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

-- 3. ENSURE kotson_create_order_from_cart SNAPSHOTS BOTH PAISE AND NORMALIZED FIELDS
CREATE OR REPLACE FUNCTION public.kotson_create_order_from_cart(
    p_cart_id UUID,
    p_shipping_address JSONB,
    p_billing_address JSONB DEFAULT NULL,
    p_guest_email TEXT DEFAULT NULL,
    p_guest_phone TEXT DEFAULT NULL,
    p_guest_first_name TEXT DEFAULT NULL,
    p_guest_last_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cart RECORD;
    v_pricing JSONB;
    v_order_id UUID := gen_random_uuid();
    v_order_number VARCHAR(64);
    v_next_val BIGINT;
    v_order RECORD;
    v_guest_token VARCHAR(128) := NULL;
    v_user_email VARCHAR(255);
    v_user_phone VARCHAR(50);
    v_res_count INT;
    v_target_user_id UUID := NULL;
    v_total_paise BIGINT;
    v_subtotal_paise BIGINT;
    v_discount_paise BIGINT;
    v_raw_items JSONB;
    v_normalized_items JSONB := '[]'::JSONB;
    v_item JSONB;
BEGIN
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cart not found');
    END IF;

    IF v_cart.items IS NULL OR jsonb_array_length(v_cart.items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cart is empty');
    END IF;

    -- Resolve user ID
    IF v_cart.user_id IS NOT NULL THEN
        SELECT id, email, phone INTO v_target_user_id, v_user_email, v_user_phone
        FROM public.users WHERE id = v_cart.user_id;
    END IF;

    IF v_target_user_id IS NULL THEN
        IF p_guest_email IS NOT NULL AND TRIM(p_guest_email) <> '' THEN
            SELECT id, email, phone INTO v_target_user_id, v_user_email, v_user_phone
            FROM public.users WHERE LOWER(email) = LOWER(TRIM(p_guest_email));
            
            IF v_target_user_id IS NULL AND p_guest_phone IS NOT NULL AND TRIM(p_guest_phone) <> '' THEN
                SELECT id, email, phone INTO v_target_user_id, v_user_email, v_user_phone
                FROM public.users WHERE phone = TRIM(p_guest_phone) OR phone = ('+91' || TRIM(p_guest_phone));
            END IF;

            IF v_target_user_id IS NULL THEN
                INSERT INTO public.users (
                    id, email, phone, first_name, last_name, role, is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(),
                    LOWER(TRIM(p_guest_email)),
                    COALESCE(TRIM(p_guest_phone), ''),
                    COALESCE(TRIM(p_guest_first_name), 'Guest'),
                    COALESCE(TRIM(p_guest_last_name), 'Customer'),
                    'customer',
                    true,
                    NOW(),
                    NOW()
                )
                RETURNING id, email, phone INTO v_target_user_id, v_user_email, v_user_phone;
            END IF;
        ELSE
            v_user_email := COALESCE(p_shipping_address->>'email', 'guest@kotsonbeds.com');
            v_user_phone := COALESCE(p_shipping_address->>'phone', '');
        END IF;
    END IF;

    -- Generate human-friendly order number (KS00001 format)
    v_next_val := nextval('public.kotson_order_number_seq');
    v_order_number := 'KS' || lpad(v_next_val::TEXT, 5, '0');

    -- Price the cart authoritatively
    v_pricing := public.kotson_calculate_pricing(
        v_cart.items,
        v_cart.referred_code,
        v_cart.coupon_code,
        v_target_user_id
    );

    IF (v_pricing->>'is_valid')::BOOLEAN IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', COALESCE(v_pricing->>'error', 'Pricing calculation failed'));
    END IF;

    -- Normalize items with both schemas (paise & standard)
    v_raw_items := v_pricing->'items';
    IF v_raw_items IS NOT NULL AND jsonb_array_length(v_raw_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_raw_items)
        LOOP
            v_normalized_items := v_normalized_items || jsonb_build_object(
                'variant_id', v_item->'variant_id',
                'product_id', v_item->'product_id',
                'product_slug', v_item->'product_slug',
                'product_name', v_item->'product_name',
                'title', v_item->'title',
                'sku', v_item->'sku',
                'image', v_item->'image',
                'image_url', v_item->'image_url',
                'quantity', COALESCE((v_item->>'quantity')::INT, (v_item->>'qty')::INT, 1),
                'qty', COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1),
                'line_total_paise', COALESCE((v_item->>'line_total_paise')::BIGINT, (v_item->>'line_total')::BIGINT, 0),
                'line_total', COALESCE((v_item->>'line_total')::BIGINT, (v_item->>'line_total_paise')::BIGINT, 0),
                'final_unit_price_paise', COALESCE((v_item->>'final_unit_price_paise')::BIGINT, (v_item->>'unit_price')::BIGINT, 0),
                'unit_price', COALESCE((v_item->>'unit_price')::BIGINT, (v_item->>'final_unit_price_paise')::BIGINT, 0),
                'sale_price_paise', v_item->'sale_price_paise',
                'mrp_paise', v_item->'mrp_paise',
                'coupon_discount_paise', v_item->'coupon_discount_paise',
                'referral_discount_paise', v_item->'referral_discount_paise'
            );
        END LOOP;
    ELSE
        v_normalized_items := v_raw_items;
    END IF;

    -- Authoritative amounts
    v_total_paise := (v_pricing->>'total_paise')::BIGINT;
    v_subtotal_paise := (v_pricing->>'subtotal_sale_paise')::BIGINT;
    v_discount_paise := (v_pricing->>'total_referral_discount_paise')::BIGINT + (v_pricing->>'total_coupon_discount_paise')::BIGINT;

    -- Insert Order
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
        v_normalized_items,
        jsonb_build_object(
            'subtotal_mrp_paise', v_pricing->'subtotal_mrp_paise',
            'total_sale_discount_paise', v_pricing->'total_sale_discount_paise',
            'subtotal_sale_paise', v_pricing->'subtotal_sale_paise',
            'total_referral_discount_paise', v_pricing->'total_referral_discount_paise',
            'total_coupon_discount_paise', v_pricing->'total_coupon_discount_paise',
            'total_paise', v_total_paise,
            'subtotal', v_subtotal_paise,
            'discount', v_discount_paise,
            'total', v_total_paise
        ),
        jsonb_build_array(jsonb_build_object('at', NOW(), 'type', 'order_created', 'detail', 'Order initialized; stock reserved')),
        v_guest_token,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_order;

    -- Re-link existing cart reservations to this order
    UPDATE public.inventory_reservations
    SET order_id = v_order_id::TEXT,
        updated_at = NOW()
    WHERE cart_id = v_cart.id AND status = 'RESERVED';

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'total_paise', v_order.total_paise,
        'subtotal_paise', v_order.subtotal_paise,
        'discount_paise', v_order.discount_paise,
        'status', v_order.status,
        'payment_status', v_order.payment_status,
        'guest_access_token', v_order.guest_access_token
    );
END;
$$;
