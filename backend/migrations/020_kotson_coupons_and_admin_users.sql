-- =============================================================================
-- Migration 020: Coupons Enhancement & Owner Admin Users RPCs
-- =============================================================================

-- 1. ADD applicable_product_ids TO coupons
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'coupons' AND column_name = 'applicable_product_ids'
    ) THEN
        ALTER TABLE public.coupons ADD COLUMN applicable_product_ids JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. UPDATE kotson_calculate_pricing TO SUPPORT PRODUCT-SPECIFIC COUPONS
CREATE OR REPLACE FUNCTION public.kotson_calculate_pricing(
    p_items jsonb, 
    p_referral_code character varying DEFAULT NULL::character varying, 
    p_coupon_code character varying DEFAULT NULL::character varying, 
    p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_item JSONB;
    v_variant_id VARCHAR(100);
    v_qty INT;
    v_variant RECORD;
    v_product RECORD;
    
    v_mrp_paise BIGINT;
    v_sale_price_paise BIGINT;
    v_sale_discount_paise BIGINT;
    v_line_ref_discount_paise BIGINT := 0;
    v_line_coupon_discount_paise BIGINT := 0;
    v_final_unit_price_paise BIGINT;
    v_line_total_paise BIGINT;
    
    v_subtotal_mrp_paise BIGINT := 0;
    v_total_sale_discount_paise BIGINT := 0;
    v_subtotal_sale_paise BIGINT := 0;
    v_eligible_coupon_sale_paise BIGINT := 0;
    v_total_referral_discount_paise BIGINT := 0;
    v_total_coupon_discount_paise BIGINT := 0;
    v_final_total_paise BIGINT := 0;
    
    v_clean_ref VARCHAR(30);
    v_ref_status VARCHAR(20) := 'none';
    v_ref_user RECORD;
    v_ref_rate NUMERIC(10, 2) := 5.0;
    v_ref_eligible BOOLEAN := FALSE;
    
    v_clean_coupon VARCHAR(50);
    v_coupon_status VARCHAR(20) := 'none';
    v_coupon_message TEXT := '';
    v_coupon RECORD;
    v_coupon_eligible BOOLEAN := FALSE;
    v_app_products JSONB := '[]'::jsonb;
    v_has_app_restriction BOOLEAN := FALSE;
    v_is_line_eligible BOOLEAN := TRUE;
    
    v_out_lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Evaluate Referral Code & Self-Referral Protection
    IF p_referral_code IS NOT NULL AND TRIM(p_referral_code) != '' THEN
        v_clean_ref := UPPER(TRIM(p_referral_code));
        
        SELECT * INTO v_ref_user FROM public.users WHERE UPPER(referral_code) = v_clean_ref AND is_active = TRUE LIMIT 1;
        
        IF NOT FOUND THEN
            v_ref_status := 'invalid';
        ELSIF p_user_id IS NOT NULL AND v_ref_user.id = p_user_id THEN
            v_ref_status := 'self';
        ELSE
            v_ref_status := 'valid';
            v_ref_eligible := TRUE;
        END IF;
    END IF;

    -- 2. First Pass: Compute Authoritative Prices per Line
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
    LOOP
        v_variant_id := v_item->>'variant_id';
        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
        
        SELECT * INTO v_variant FROM public.product_variants WHERE id = v_variant_id;
        IF NOT FOUND OR NOT v_variant.is_active THEN
            CONTINUE;
        END IF;
        
        SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
        IF NOT FOUND OR NOT v_product.is_active THEN
            CONTINUE;
        END IF;
        
        v_sale_price_paise := v_variant.price_paise;
        
        IF v_variant.mrp_paise IS NOT NULL AND v_variant.mrp_paise > v_variant.price_paise THEN
            v_mrp_paise := v_variant.mrp_paise;
        ELSE
            v_mrp_paise := (ROUND((v_sale_price_paise::numeric / 100.0) / 0.60)::bigint) * 100;
        END IF;
        
        v_sale_discount_paise := GREATEST(0, v_mrp_paise - v_sale_price_paise);
        
        v_subtotal_mrp_paise := v_subtotal_mrp_paise + (v_mrp_paise * v_qty);
        v_total_sale_discount_paise := v_total_sale_discount_paise + (v_sale_discount_paise * v_qty);
        v_subtotal_sale_paise := v_subtotal_sale_paise + (v_sale_price_paise * v_qty);
    END LOOP;

    -- 3. Evaluate Coupon Validity & Product Restrictions
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
        v_clean_coupon := UPPER(TRIM(p_coupon_code));
        SELECT * INTO v_coupon FROM public.coupons WHERE code = v_clean_coupon AND is_active = TRUE LIMIT 1;
        
        IF NOT FOUND THEN
            v_coupon_status := 'invalid';
            v_coupon_message := 'Coupon code not found or inactive';
        ELSIF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
            v_coupon_status := 'expired';
            v_coupon_message := 'Coupon is not yet active';
        ELSIF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
            v_coupon_status := 'expired';
            v_coupon_message := 'Coupon has expired';
        ELSIF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
            v_coupon_status := 'limit_reached';
            v_coupon_message := 'Coupon usage limit has been reached';
        ELSIF v_subtotal_sale_paise < v_coupon.min_order_value_paise THEN
            v_coupon_status := 'min_order_unmet';
            v_coupon_message := format('Minimum order value of ₹%s required', (v_coupon.min_order_value_paise / 100));
        ELSIF v_ref_eligible AND NOT v_coupon.stackable_with_referral THEN
            v_coupon_status := 'not_stackable';
            v_coupon_message := 'Coupon cannot be combined with referral discounts';
        ELSE
            -- Check product restrictions
            v_app_products := COALESCE(v_coupon.applicable_product_ids, '[]'::jsonb);
            v_has_app_restriction := (jsonb_typeof(v_app_products) = 'array' AND jsonb_array_length(v_app_products) > 0);
            
            IF v_has_app_restriction THEN
                -- Calculate eligible sale total
                v_eligible_coupon_sale_paise := 0;
                FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
                LOOP
                    v_variant_id := v_item->>'variant_id';
                    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
                    SELECT * INTO v_variant FROM public.product_variants WHERE id = v_variant_id;
                    IF FOUND AND v_variant.is_active THEN
                        IF v_app_products @> to_jsonb(v_variant.product_id::text) OR v_app_products @> to_jsonb(v_variant.id::text) THEN
                            v_eligible_coupon_sale_paise := v_eligible_coupon_sale_paise + (v_variant.price_paise * v_qty);
                        END IF;
                    END IF;
                END LOOP;
                
                IF v_eligible_coupon_sale_paise <= 0 THEN
                    v_coupon_status := 'ineligible_products';
                    v_coupon_message := 'Coupon is not applicable to the selected items in your cart';
                ELSE
                    v_coupon_status := 'valid';
                    v_coupon_eligible := TRUE;
                    v_coupon_message := 'Coupon applied successfully';
                END IF;
            ELSE
                v_eligible_coupon_sale_paise := v_subtotal_sale_paise;
                v_coupon_status := 'valid';
                v_coupon_eligible := TRUE;
                v_coupon_message := 'Coupon applied successfully';
            END IF;
        END IF;
    END IF;

    -- 4. Calculate Total Discounts (Price Waterfall)
    IF v_ref_eligible THEN
        v_total_referral_discount_paise := ROUND(v_subtotal_sale_paise * (v_ref_rate / 100.0))::BIGINT;
    END IF;

    IF v_coupon_eligible THEN
        IF v_coupon.discount_type = 'percentage' THEN
            v_total_coupon_discount_paise := ROUND(v_eligible_coupon_sale_paise * (v_coupon.discount_value / 100.0))::BIGINT;
            IF v_coupon.max_discount_paise IS NOT NULL THEN
                v_total_coupon_discount_paise := LEAST(v_total_coupon_discount_paise, v_coupon.max_discount_paise);
            END IF;
        ELSIF v_coupon.discount_type = 'fixed' OR v_coupon.discount_type = 'flat' THEN
            v_total_coupon_discount_paise := LEAST(ROUND(v_coupon.discount_value * 100)::BIGINT, v_eligible_coupon_sale_paise);
        END IF;
    END IF;

    v_final_total_paise := GREATEST(0, v_subtotal_sale_paise - v_total_referral_discount_paise - v_total_coupon_discount_paise);

    -- 5. Second Pass: Build Detailed Item Breakdown with Line Totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
    LOOP
        v_variant_id := v_item->>'variant_id';
        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
        
        SELECT * INTO v_variant FROM public.product_variants WHERE id = v_variant_id;
        IF NOT FOUND OR NOT v_variant.is_active THEN
            CONTINUE;
        END IF;
        
        SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
        IF NOT FOUND OR NOT v_product.is_active THEN
            CONTINUE;
        END IF;
        
        v_sale_price_paise := v_variant.price_paise;
        IF v_variant.mrp_paise IS NOT NULL AND v_variant.mrp_paise > v_variant.price_paise THEN
            v_mrp_paise := v_variant.mrp_paise;
        ELSE
            v_mrp_paise := (ROUND((v_sale_price_paise::numeric / 100.0) / 0.60)::bigint) * 100;
        END IF;
        v_sale_discount_paise := GREATEST(0, v_mrp_paise - v_sale_price_paise);
        
        -- Pro-rata referral discount
        IF v_subtotal_sale_paise > 0 THEN
            v_line_ref_discount_paise := ROUND(v_total_referral_discount_paise * ((v_sale_price_paise * v_qty)::NUMERIC / v_subtotal_sale_paise::NUMERIC) / v_qty)::BIGINT;
        ELSE
            v_line_ref_discount_paise := 0;
        END IF;

        -- Pro-rata coupon discount on eligible items
        v_is_line_eligible := NOT v_has_app_restriction OR (v_app_products @> to_jsonb(v_product.id::text) OR v_app_products @> to_jsonb(v_variant.id::text));
        IF v_is_line_eligible AND v_eligible_coupon_sale_paise > 0 THEN
            v_line_coupon_discount_paise := ROUND(v_total_coupon_discount_paise * ((v_sale_price_paise * v_qty)::NUMERIC / v_eligible_coupon_sale_paise::NUMERIC) / v_qty)::BIGINT;
        ELSE
            v_line_coupon_discount_paise := 0;
        END IF;
        
        v_final_unit_price_paise := GREATEST(0, v_sale_price_paise - v_line_ref_discount_paise - v_line_coupon_discount_paise);
        v_line_total_paise := v_final_unit_price_paise * v_qty;
        
        v_out_lines := v_out_lines || jsonb_build_object(
            'variant_id', v_variant.id,
            'product_id', v_product.id,
            'product_name', v_product.name,
            'product_slug', v_product.slug,
            'sku', v_variant.sku,
            'title', v_variant.title,
            'mrp_paise', v_mrp_paise,
            'sale_discount_paise', v_sale_discount_paise,
            'sale_price_paise', v_sale_price_paise,
            'referral_discount_paise', v_line_ref_discount_paise,
            'coupon_discount_paise', v_line_coupon_discount_paise,
            'final_unit_price_paise', v_final_unit_price_paise,
            'quantity', v_qty,
            'line_total_paise', v_line_total_paise,
            'stock', v_variant.stock,
            'reserved', v_variant.reserved,
            'available', GREATEST(0, v_variant.stock - v_variant.reserved),
            'is_active', (v_variant.is_active AND v_product.is_active)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'items', v_out_lines,
        'item_count', (SELECT COALESCE(SUM((x->>'quantity')::INT), 0) FROM jsonb_array_elements(v_out_lines) x),
        'subtotal_mrp_paise', v_subtotal_mrp_paise,
        'total_sale_discount_paise', v_total_sale_discount_paise,
        'subtotal_sale_paise', v_subtotal_sale_paise,
        'total_referral_discount_paise', v_total_referral_discount_paise,
        'total_coupon_discount_paise', v_total_coupon_discount_paise,
        'final_total_paise', v_final_total_paise,
        'referral_code', CASE WHEN v_ref_eligible THEN v_clean_ref ELSE NULL END,
        'referral_status', v_ref_status,
        'coupon_code', CASE WHEN v_coupon_eligible THEN v_clean_coupon ELSE NULL END,
        'coupon_status', v_coupon_status,
        'coupon_message', v_coupon_message
    );
END;
-- 3. ENSURE is_admin_or_owner SUPPORTS SERVICE ROLE & OWNER/ADMIN
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT (
        COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
        OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE supabase_auth_id = auth.uid()
              AND is_active = TRUE
              AND (roles && ARRAY['owner', 'admin']::TEXT[])
        )
    );
$function$;

-- 4. SECURE ADMIN RPC: kotson_admin_get_users
CREATE OR REPLACE FUNCTION public.kotson_admin_get_users(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_users JSONB := '[]'::jsonb;
    v_metrics JSONB;
    v_total_signups INT := 0;
    v_today_signups INT := 0;
    v_new_customers INT := 0;
    v_total_customers INT := 0;
    v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
    v_seven_days_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
    r RECORD;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied: Admin/Owner role required';
    END IF;

    -- Aggregate metrics across all users
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE created_at >= v_today_start),
        COUNT(*) FILTER (WHERE created_at >= v_seven_days_ago AND 'customer' = ANY(roles)),
        COUNT(*) FILTER (WHERE 'customer' = ANY(roles))
    INTO 
        v_total_signups,
        v_today_signups,
        v_new_customers,
        v_total_customers
    FROM public.users;

    v_metrics := jsonb_build_object(
        'total_signups', v_total_signups,
        'today_signups', v_today_signups,
        'new_customers', v_new_customers,
        'total_customers', v_total_customers
    );

    -- Fetch user list with orders and addresses
    FOR r IN
        SELECT 
            u.id,
            u.email,
            u.phone,
            u.name,
            u.roles,
            u.is_active,
            u.created_at,
            u.updated_at,
            u.referral_code,
            COALESCE(ord.order_count, 0) AS order_count,
            COALESCE(ord.total_spend_paise, 0) AS total_spend_paise,
            COALESCE(addr.addresses, '[]'::jsonb) AS addresses
        FROM public.users u
        LEFT JOIN LATERAL (
            SELECT 
                COUNT(*) AS order_count,
                COALESCE(SUM(total_paise), 0) AS total_spend_paise
            FROM public.orders o
            WHERE o.user_id = u.id AND o.payment_status = 'paid'
        ) ord ON TRUE
        LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'full_name', a.full_name,
                'phone', a.phone,
                'line1', a.line1,
                'city', a.city,
                'state', a.state,
                'pincode', a.pincode,
                'is_default', a.is_default
            )) AS addresses
            FROM public.user_addresses a
            WHERE a.user_id = u.id
        ) addr ON TRUE
        WHERE 
            (p_start_date IS NULL OR u.created_at >= p_start_date)
            AND (p_end_date IS NULL OR u.created_at <= p_end_date)
            AND (p_role IS NULL OR p_role = '' OR p_role = ANY(u.roles))
            AND (
                p_search IS NULL OR p_search = '' 
                OR u.name ILIKE '%' || p_search || '%' 
                OR u.email ILIKE '%' || p_search || '%' 
                OR u.phone ILIKE '%' || p_search || '%'
                OR u.referral_code ILIKE '%' || p_search || '%'
            )
        ORDER BY u.created_at DESC
    LOOP
        v_users := v_users || jsonb_build_object(
            'id', r.id,
            'email', r.email,
            'phone', r.phone,
            'name', r.name,
            'roles', r.roles,
            'is_active', r.is_active,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'referral_code', r.referral_code,
            'orders_count', r.order_count,
            'total_purchase_paise', r.total_spend_paise,
            'total_purchase_rupees', ROUND(r.total_spend_paise::numeric / 100.0, 2),
            'addresses', r.addresses
        );
    END LOOP;

    RETURN jsonb_build_object(
        'metrics', v_metrics,
        'users', v_users,
        'total', jsonb_array_length(v_users)
    );
END;
$$;

-- 4. SECURE ADMIN RPC: kotson_admin_user_action (Create, Edit, Soft-Deactivate)
CREATE OR REPLACE FUNCTION public.kotson_admin_user_action(
    p_action TEXT, -- 'create', 'edit', 'deactivate', 'activate', 'delete'
    p_user_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_orders_count INT := 0;
    v_new_id UUID;
    v_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_roles TEXT[];
    v_is_active BOOLEAN;
    v_audit_action TEXT;
    v_audit_details JSONB;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied: Admin/Owner role required';
    END IF;

    IF p_action = 'create' THEN
        v_name := TRIM(COALESCE(p_payload->>'name', ''));
        v_email := LOWER(TRIM(COALESCE(p_payload->>'email', '')));
        v_phone := NULLIF(TRIM(COALESCE(p_payload->>'phone', '')), '');
        
        IF v_name = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
        IF v_email = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
        
        -- Check duplicate
        IF EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
            RAISE EXCEPTION 'A user with email % already exists', v_email;
        END IF;

        v_new_id := gen_random_uuid();
        INSERT INTO public.users (
            id,
            name,
            email,
            phone,
            roles,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            v_new_id,
            v_name,
            v_email,
            v_phone,
            ARRAY['customer'],
            TRUE,
            NOW(),
            NOW()
        );

        -- Audit Log
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            p_actor_id,
            'admin_create_user',
            'user',
            v_new_id::text,
            jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone)
        );

        RETURN jsonb_build_object('ok', TRUE, 'message', 'User created successfully', 'user_id', v_new_id);

    ELSIF p_action = 'edit' THEN
        IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required'; END IF;
        SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

        v_name := COALESCE(NULLIF(TRIM(p_payload->>'name'), ''), v_user.name);
        v_phone := COALESCE(NULLIF(TRIM(p_payload->>'phone'), ''), v_user.phone);
        
        IF p_payload ? 'is_active' THEN
            v_is_active := (p_payload->>'is_active')::BOOLEAN;
        ELSE
            v_is_active := v_user.is_active;
        END IF;

        UPDATE public.users
        SET 
            name = v_name,
            phone = v_phone,
            is_active = v_is_active,
            updated_at = NOW()
        WHERE id = p_user_id;

        -- Audit Log
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (
            p_actor_id,
            'admin_edit_user',
            'user',
            p_user_id::text,
            jsonb_build_object('name', v_name, 'phone', v_phone, 'is_active', v_is_active)
        );

        RETURN jsonb_build_object('ok', TRUE, 'message', 'User updated successfully');

    ELSIF p_action = 'deactivate' THEN
        IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required'; END IF;
        
        UPDATE public.users SET is_active = FALSE, updated_at = NOW() WHERE id = p_user_id;
        
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_actor_id, 'admin_deactivate_user', 'user', p_user_id::text, jsonb_build_object('status', 'deactivated'));

        RETURN jsonb_build_object('ok', TRUE, 'message', 'User deactivated successfully');

    ELSIF p_action = 'activate' THEN
        IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required'; END IF;
        
        UPDATE public.users SET is_active = TRUE, updated_at = NOW() WHERE id = p_user_id;
        
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_actor_id, 'admin_activate_user', 'user', p_user_id::text, jsonb_build_object('status', 'activated'));

        RETURN jsonb_build_object('ok', TRUE, 'message', 'User activated successfully');

    ELSIF p_action = 'delete' THEN
        IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required'; END IF;
        
        -- Check financial / history protection
        SELECT COUNT(*) INTO v_orders_count FROM public.orders WHERE user_id = p_user_id;
        
        IF v_orders_count > 0 THEN
            -- PROTECT FINANCIAL HISTORY: Safe Soft-Delete / Deactivate
            UPDATE public.users SET is_active = FALSE, updated_at = NOW() WHERE id = p_user_id;
            
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (
                p_actor_id,
                'admin_soft_delete_user',
                'user',
                p_user_id::text,
                jsonb_build_object('reason', 'User has existing orders; safely deactivated to protect financial history', 'orders_count', v_orders_count)
            );

            RETURN jsonb_build_object(
                'ok', TRUE, 
                'message', 'User has existing purchase history. Account has been safely deactivated to protect order and financial records.',
                'soft_deleted', TRUE
            );
        ELSE
            -- User has no orders or financial records: safe to soft delete or clean delete
            UPDATE public.users SET is_active = FALSE, updated_at = NOW() WHERE id = p_user_id;
            
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (p_actor_id, 'admin_delete_user', 'user', p_user_id::text, jsonb_build_object('status', 'deactivated'));

            RETURN jsonb_build_object('ok', TRUE, 'message', 'User deactivated and removed from active roster');
        END IF;

    ELSE
        RAISE EXCEPTION 'Unknown user action: %', p_action;
    END IF;
END;
$$;
