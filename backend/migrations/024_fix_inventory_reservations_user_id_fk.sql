-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 024
-- SURGICAL FIX FOR INVENTORY_RESERVATIONS USER_ID FOREIGN KEY RESOLUTION
-- =============================================================================
-- Root Cause Resolution:
-- 1. inventory_reservations.user_id has FK constraint referencing public.users(id).
-- 2. Supabase Auth callers supply auth.users.id (auth.uid()) or legacy/unmapped user IDs.
-- 3. kotson_reserve_inventory now authoritatively resolves auth.users.id -> public.users.id.
-- 4. If user is guest/unauthenticated, user_id safely resolves to NULL (nullable FK).
-- 5. Foreign Key constraint inventory_reservations_user_id_fkey is PRESERVED intact.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kotson_reserve_inventory(
    p_cart_id UUID,
    p_user_id UUID,
    p_items JSONB,
    p_ttl_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_var_id TEXT;
    v_qty INT;
    v_variant RECORD;
    v_avail INT;
    v_res_id UUID;
    v_created_reservations JSONB := '[]'::JSONB;
    v_target_user_id UUID := NULL;
    v_auth_uid UUID := auth.uid();
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No items provided for reservation';
    END IF;

    -- Authoritative Identity Resolution for public.users(id) Foreign Key Constraint
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

    -- Loop and acquire exclusive row locks on each variant
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_var_id := v_item->>'variant_id';
        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1));

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Invalid quantity % for variant %', v_qty, v_var_id;
        END IF;

        -- ROW LOCK: blocks concurrent transactions on the exact variant
        SELECT * INTO v_variant 
        FROM public.product_variants 
        WHERE id = v_var_id 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Variant % not found', v_var_id;
        END IF;

        IF NOT v_variant.is_active THEN
            RAISE EXCEPTION 'Variant % is inactive', v_var_id;
        END IF;

        v_avail := v_variant.stock - v_variant.reserved;
        IF v_avail < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: variant % requested % but available %', v_var_id, v_qty, v_avail;
        END IF;

        -- Deduct available stock by incrementing reserved atomically
        UPDATE public.product_variants 
        SET reserved = reserved + v_qty 
        WHERE id = v_var_id;

        -- Insert reservation record with resolved v_target_user_id (guaranteed valid public.users.id or NULL)
        v_res_id := gen_random_uuid();
        INSERT INTO public.inventory_reservations (
            id, cart_id, user_id, variant_id, qty, status, expires_at, created_at
        ) VALUES (
            v_res_id, p_cart_id, v_target_user_id, v_var_id, v_qty, 'RESERVED',
            NOW() + (p_ttl_minutes || ' minutes')::INTERVAL, NOW()
        );

        v_created_reservations := v_created_reservations || jsonb_build_object(
            'reservation_id', v_res_id,
            'variant_id', v_var_id,
            'qty', v_qty,
            'expires_at', NOW() + (p_ttl_minutes || ' minutes')::INTERVAL
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'reservations', v_created_reservations
    );
END;
$$;
