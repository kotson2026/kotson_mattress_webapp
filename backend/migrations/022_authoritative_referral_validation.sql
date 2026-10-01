-- 022_authoritative_referral_validation.sql
-- Authoritative server-side referral validation and discount stacking enforcement

-- 1. Create authoritative referral validator RPC
CREATE OR REPLACE FUNCTION public.kotson_validate_referral_code(
    p_code TEXT, 
    p_user_id UUID DEFAULT NULL::UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_clean TEXT;
    v_user RECORD;
BEGIN
    v_clean := UPPER(TRIM(COALESCE(p_code, '')));
    
    IF v_clean = '' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'empty',
            'message', 'Referral code cannot be empty'
        );
    END IF;

    SELECT id, name, referral_code, is_active 
    INTO v_user 
    FROM public.users 
    WHERE UPPER(TRIM(referral_code)) = v_clean 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'not_found',
            'message', 'Referral code is invalid or unavailable.'
        );
    END IF;

    IF NOT v_user.is_active THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'inactive',
            'message', 'This referral code belongs to an inactive account.'
        );
    END IF;

    IF p_user_id IS NOT NULL AND v_user.id = p_user_id THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'self_referral',
            'message', 'You cannot use your own referral code.'
        );
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'code', v_user.referral_code,
        'referrer_id', v_user.id,
        'referrer_name', v_user.name,
        'message', 'Referral code applied'
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kotson_validate_referral_code(TEXT, UUID) TO anon, authenticated, service_role;

-- 2. Update kotson_cart_apply_referral to validate code authoritatively
CREATE OR REPLACE FUNCTION public.kotson_cart_apply_referral(
    p_cart_id uuid, 
    p_token text, 
    p_referral_code text, 
    p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_cart RECORD;
    v_token_hash VARCHAR(64);
    v_clean_ref TEXT;
    v_val_res JSONB;
    v_effective_user_id UUID;
BEGIN
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cart not found'; END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    v_effective_user_id := COALESCE(p_user_id, v_cart.user_id);
    v_clean_ref := NULLIF(UPPER(TRIM(COALESCE(p_referral_code, ''))), '');

    IF v_clean_ref IS NOT NULL THEN
        v_val_res := public.kotson_validate_referral_code(v_clean_ref, v_effective_user_id);
        IF NOT (v_val_res->>'valid')::BOOLEAN THEN
            RAISE EXCEPTION '%', COALESCE(v_val_res->>'message', 'Referral code is invalid or unavailable.');
        END IF;
        v_clean_ref := v_val_res->>'code';
    END IF;

    UPDATE public.carts 
    SET referred_code = v_clean_ref, updated_at = NOW() 
    WHERE id = p_cart_id;

    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kotson_cart_apply_referral(UUID, TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- 3. Update kotson_cart_apply_coupon to validate coupon authoritatively
CREATE OR REPLACE FUNCTION public.kotson_cart_apply_coupon(
    p_cart_id uuid, 
    p_token text, 
    p_coupon_code text, 
    p_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_cart RECORD;
    v_token_hash VARCHAR(64);
    v_clean_coupon TEXT;
    v_coupon RECORD;
BEGIN
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cart not found'; END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    v_clean_coupon := NULLIF(UPPER(TRIM(COALESCE(p_coupon_code, ''))), '');

    IF v_clean_coupon IS NOT NULL THEN
        SELECT * INTO v_coupon FROM public.coupons WHERE UPPER(code) = v_clean_coupon AND is_active = TRUE LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Coupon code is invalid or inactive';
        END IF;
        IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > NOW() THEN
            RAISE EXCEPTION 'Coupon is not yet active';
        END IF;
        IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
            RAISE EXCEPTION 'Coupon has expired';
        END IF;
        IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
            RAISE EXCEPTION 'Coupon usage limit has been reached';
        END IF;
        v_clean_coupon := v_coupon.code;
    END IF;

    UPDATE public.carts 
    SET coupon_code = v_clean_coupon, updated_at = NOW() 
    WHERE id = p_cart_id;

    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kotson_cart_apply_coupon(UUID, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
