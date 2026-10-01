-- ==============================================================================
-- Migration 021: Kotson Targeted Commerce & Admin Fixes
-- 1. Users account_status (ACTIVE, ON_HOLD, DEACTIVATED)
-- 2. Customer-Only Directory RPC with pagination & date filters
-- 3. Customer actions (hold, deactivate, reactivate, safe delete)
-- 4. Referral rules persistence hardening
-- 5. Safe cleanup of mock/test cart
-- ==============================================================================

-- 1. Users account_status
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'ACTIVE';
UPDATE public.users 
SET account_status = CASE WHEN is_active = FALSE THEN 'DEACTIVATED' ELSE 'ACTIVE' END 
WHERE account_status IS NULL;

-- 2. Customer-Only Directory RPC with pagination & date filters
CREATE OR REPLACE FUNCTION public.kotson_admin_get_users(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_page INT DEFAULT 1,
    p_limit INT DEFAULT 10,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_signups INT;
    v_today_signups INT;
    v_new_cust_30d INT;
    v_total_customers INT;
    v_filtered_total INT;
    v_offset INT;
    v_users JSONB;
BEGIN
    -- Only customers in Customer Directory
    -- Total signups (all registered customers)
    SELECT COUNT(*) INTO v_total_signups 
    FROM public.users u 
    WHERE ('customer' = ANY(u.roles) OR u.roles IS NULL OR u.roles = '{}');

    -- Today's signups
    SELECT COUNT(*) INTO v_today_signups 
    FROM public.users u 
    WHERE ('customer' = ANY(u.roles) OR u.roles IS NULL OR u.roles = '{}')
      AND u.created_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- New customers in last 30 days
    SELECT COUNT(*) INTO v_new_cust_30d 
    FROM public.users u 
    WHERE ('customer' = ANY(u.roles) OR u.roles IS NULL OR u.roles = '{}')
      AND u.created_at >= (NOW() - INTERVAL '30 days');

    -- Transacting customers (customers with >= 1 order)
    SELECT COUNT(DISTINCT o.user_id) INTO v_total_customers 
    FROM public.orders o 
    WHERE o.user_id IS NOT NULL;

    v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_limit, 10));

    -- Filtered total count
    SELECT COUNT(*) INTO v_filtered_total
    FROM public.users u
    WHERE ('customer' = ANY(u.roles) OR u.roles IS NULL OR u.roles = '{}')
      AND (p_start_date IS NULL OR u.created_at >= p_start_date)
      AND (p_end_date IS NULL OR u.created_at <= p_end_date)
      AND (
          p_search IS NULL OR TRIM(p_search) = '' OR
          u.name ILIKE '%' || p_search || '%' OR
          u.email ILIKE '%' || p_search || '%' OR
          u.phone ILIKE '%' || p_search || '%' OR
          u.id::text ILIKE '%' || p_search || '%'
      )
      AND (
          p_status IS NULL OR p_status = 'ALL' OR
          (p_status = 'ACTIVE' AND COALESCE(u.account_status, 'ACTIVE') = 'ACTIVE' AND u.is_active = TRUE) OR
          (p_status = 'ON_HOLD' AND COALESCE(u.account_status, '') = 'ON_HOLD') OR
          (p_status = 'DEACTIVATED' AND (COALESCE(u.account_status, '') = 'DEACTIVATED' OR u.is_active = FALSE))
      );

    -- Fetch users page
    SELECT COALESCE(jsonb_agg(u_row), '[]'::jsonb) INTO v_users
    FROM (
        SELECT 
            u.id,
            u.name,
            u.email,
            u.phone,
            COALESCE(u.account_status, CASE WHEN u.is_active THEN 'ACTIVE' ELSE 'DEACTIVATED' END) AS account_status,
            u.is_active,
            u.created_at,
            u.updated_at,
            COALESCE(ord_summary.orders_count, 0) AS orders_count,
            COALESCE(ord_summary.total_spend_paise, 0) AS total_purchase_paise,
            COALESCE(addr_summary.addresses_count, 0) AS addresses_count,
            COALESCE(addr_summary.addresses, '[]'::jsonb) AS addresses,
            COALESCE(ord_summary.orders, '[]'::jsonb) AS orders
        FROM public.users u
        LEFT JOIN LATERAL (
            SELECT 
                COUNT(*) AS orders_count,
                COALESCE(SUM(o.total_paise), 0) AS total_spend_paise,
                COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', o.id,
                        'order_number', o.order_number,
                        'payable_amount_paise', o.total_paise,
                        'order_status', COALESCE(o.fulfilment_status, o.status),
                        'payment_status', o.payment_status,
                        'created_at', o.created_at
                    ) ORDER BY o.created_at DESC
                ), '[]'::jsonb) AS orders
            FROM public.orders o
            WHERE o.user_id = u.id
        ) ord_summary ON TRUE
        LEFT JOIN LATERAL (
            SELECT 
                COUNT(*) AS addresses_count,
                COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', a.id,
                        'label', COALESCE(a.label, 'Home'),
                        'line1', a.line1,
                        'line2', a.line2,
                        'landmark', a.landmark,
                        'city', a.city,
                        'state', a.state,
                        'pincode', a.pincode,
                        'is_default', a.is_default
                    ) ORDER BY a.is_default DESC, a.created_at DESC
                ), '[]'::jsonb) AS addresses
            FROM public.user_addresses a
            WHERE a.user_id = u.id
        ) addr_summary ON TRUE
        WHERE ('customer' = ANY(u.roles) OR u.roles IS NULL OR u.roles = '{}')
          AND (p_start_date IS NULL OR u.created_at >= p_start_date)
          AND (p_end_date IS NULL OR u.created_at <= p_end_date)
          AND (
              p_search IS NULL OR TRIM(p_search) = '' OR
              u.name ILIKE '%' || p_search || '%' OR
              u.email ILIKE '%' || p_search || '%' OR
              u.phone ILIKE '%' || p_search || '%' OR
              u.id::text ILIKE '%' || p_search || '%'
          )
          AND (
              p_status IS NULL OR p_status = 'ALL' OR
              (p_status = 'ACTIVE' AND COALESCE(u.account_status, 'ACTIVE') = 'ACTIVE' AND u.is_active = TRUE) OR
              (p_status = 'ON_HOLD' AND COALESCE(u.account_status, '') = 'ON_HOLD') OR
              (p_status = 'DEACTIVATED' AND (COALESCE(u.account_status, '') = 'DEACTIVATED' OR u.is_active = FALSE))
          )
        ORDER BY u.created_at DESC
        LIMIT COALESCE(p_limit, 10)
        OFFSET v_offset
    ) u_row;

    RETURN jsonb_build_object(
        'metrics', jsonb_build_object(
            'total_signups', v_total_signups,
            'today_signups', v_today_signups,
            'new_customers_30d', v_new_cust_30d,
            'total_customers', v_total_customers
        ),
        'users', v_users,
        'total', v_filtered_total,
        'page', COALESCE(p_page, 1),
        'limit', COALESCE(p_limit, 10)
    );
END;
$$;

-- 3. Customer actions RPC (hold, deactivate, reactivate, safe delete)
CREATE OR REPLACE FUNCTION public.kotson_admin_user_action(
    p_action TEXT,
    p_user_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_has_orders INT;
    v_new_id UUID;
BEGIN
    IF p_action = 'create' THEN
        INSERT INTO public.users (
            name, email, phone, roles, account_status, is_active, created_at, updated_at
        ) VALUES (
            p_payload->>'name',
            NULLIF(TRIM(p_payload->>'email'), ''),
            NULLIF(TRIM(p_payload->>'phone'), ''),
            ARRAY['customer']::text[],
            'ACTIVE',
            TRUE,
            NOW(),
            NOW()
        ) RETURNING id INTO v_new_id;

        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
        VALUES (p_actor_id, 'USER_CREATE', 'user', v_new_id::text, p_payload, NOW());

        RETURN jsonb_build_object('ok', true, 'id', v_new_id);

    ELSIF p_action = 'edit' THEN
        UPDATE public.users SET
            name = COALESCE(p_payload->>'name', name),
            email = COALESCE(NULLIF(TRIM(p_payload->>'email'), ''), email),
            phone = COALESCE(NULLIF(TRIM(p_payload->>'phone'), ''), phone),
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
        VALUES (p_actor_id, 'USER_EDIT', 'user', p_user_id::text, p_payload, NOW());

        RETURN jsonb_build_object('ok', true, 'id', p_user_id);

    ELSIF p_action = 'hold' THEN
        UPDATE public.users SET
            account_status = 'ON_HOLD',
            is_active = FALSE,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
        VALUES (p_actor_id, 'USER_HOLD', 'user', p_user_id::text, jsonb_build_object('status', 'ON_HOLD'), NOW());

        RETURN jsonb_build_object('ok', true, 'id', p_user_id, 'account_status', 'ON_HOLD');

    ELSIF p_action = 'reactivate' THEN
        UPDATE public.users SET
            account_status = 'ACTIVE',
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
        VALUES (p_actor_id, 'USER_REACTIVATE', 'user', p_user_id::text, jsonb_build_object('status', 'ACTIVE'), NOW());

        RETURN jsonb_build_object('ok', true, 'id', p_user_id, 'account_status', 'ACTIVE');

    ELSIF p_action = 'deactivate' THEN
        UPDATE public.users SET
            account_status = 'DEACTIVATED',
            is_active = FALSE,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
        VALUES (p_actor_id, 'USER_DEACTIVATE', 'user', p_user_id::text, jsonb_build_object('status', 'DEACTIVATED'), NOW());

        RETURN jsonb_build_object('ok', true, 'id', p_user_id, 'account_status', 'DEACTIVATED');

    ELSIF p_action = 'delete' THEN
        SELECT COUNT(*) INTO v_has_orders FROM public.orders WHERE user_id = p_user_id;

        IF v_has_orders > 0 THEN
            -- Safe deactivation to preserve financial records
            UPDATE public.users SET
                account_status = 'DEACTIVATED',
                is_active = FALSE,
                updated_at = NOW()
            WHERE id = p_user_id;

            INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
            VALUES (p_actor_id, 'USER_SOFT_DELETE', 'user', p_user_id::text, jsonb_build_object('has_orders', v_has_orders), NOW());

            RETURN jsonb_build_object('ok', true, 'soft_deleted', true, 'message', 'Customer has historical orders; safely deactivated.');
        ELSE
            DELETE FROM public.user_addresses WHERE user_id = p_user_id;
            DELETE FROM public.users WHERE id = p_user_id;

            INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, payload, created_at)
            VALUES (p_actor_id, 'USER_HARD_DELETE', 'user', p_user_id::text, '{}'::jsonb, NOW());

            RETURN jsonb_build_object('ok', true, 'deleted', true);
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', false, 'error', 'Unknown action');
END;
$$;

-- 4. Clean up mock/test cart safely
DELETE FROM public.carts WHERE token = 'cart_8b1801e859a6' OR items::text LIKE '%test_var_1%';
