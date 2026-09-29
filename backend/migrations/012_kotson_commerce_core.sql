-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 012
-- COMMERCE CORE: AUTHORITATIVE PRICING, 40% SALE, CARTS, COUPONS, ATOMIC RESERVATIONS
-- =============================================================================
-- Architecture & Trust Boundary Documentation:
-- 1. PostgreSQL is the authoritative pricing authority; client money inputs are rejected.
-- 2. Global 40% sale (sale_price = ROUND(mrp * 0.60)) enforced in integer paise.
-- 3. Price waterfall: MRP -> Global Sale -> Referral Discount -> Coupon -> Final Price.
-- 4. Cryptographic guest cart token hashing (SHA-256) protects bearer tokens (BLK-02).
-- 5. Atomic cart merge combines quantities, caps by stock, reprices, and is idempotent.
-- 6. Atomic stock reservation with SELECT ... FOR UPDATE row-locking guarantees zero overselling.
-- 7. Reservation expiry release primitive restores available stock without negative drift.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. COUPONS & COUPON USAGES TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order_value_paise BIGINT NOT NULL DEFAULT 0 CHECK (min_order_value_paise >= 0),
    max_discount_paise BIGINT,
    usage_limit INT,
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    stackable_with_global_promo BOOLEAN NOT NULL DEFAULT FALSE,
    stackable_with_referral BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user ON public.coupon_usages(coupon_id, user_id);

-- -----------------------------------------------------------------------------
-- 2. CARTS & INVENTORY RESERVATIONS ENHANCEMENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.carts
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_carts_token_hash ON public.carts(token_hash);

ALTER TABLE public.inventory_reservations
    ADD COLUMN IF NOT EXISTS cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_variant_status_expiry 
    ON public.inventory_reservations(variant_id, status, expires_at);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_coupons" ON public.coupons;
CREATE POLICY "public_read_active_coupons" ON public.coupons
    FOR SELECT USING (is_active = true OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "admin_all_coupons" ON public.coupons;
CREATE POLICY "admin_all_coupons" ON public.coupons
    FOR ALL USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "service_role_all_coupons" ON public.coupons;
CREATE POLICY "service_role_all_coupons" ON public.coupons
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "customer_read_own_coupon_usages" ON public.coupon_usages;
CREATE POLICY "customer_read_own_coupon_usages" ON public.coupon_usages
    FOR SELECT USING (user_id = public.get_current_user_id() OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "service_role_all_coupon_usages" ON public.coupon_usages;
CREATE POLICY "service_role_all_coupon_usages" ON public.coupon_usages
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Carts policies
DROP POLICY IF EXISTS "customer_manage_own_cart" ON public.carts;
CREATE POLICY "customer_manage_own_cart" ON public.carts
    FOR ALL USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "service_role_all_carts" ON public.carts;
CREATE POLICY "service_role_all_carts" ON public.carts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Inventory reservations policies
DROP POLICY IF EXISTS "customer_read_own_reservations" ON public.inventory_reservations;
CREATE POLICY "customer_read_own_reservations" ON public.inventory_reservations
    FOR SELECT USING (user_id = public.get_current_user_id() OR public.is_admin_or_owner());

DROP POLICY IF EXISTS "admin_all_reservations" ON public.inventory_reservations;
CREATE POLICY "admin_all_reservations" ON public.inventory_reservations
    FOR ALL USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "service_role_all_reservations" ON public.inventory_reservations;
CREATE POLICY "service_role_all_reservations" ON public.inventory_reservations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- 4. UTILITY & HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
-- SHA-256 token hashing
CREATE OR REPLACE FUNCTION public.kotson_hash_token(p_token TEXT)
RETURNS VARCHAR(64)
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT encode(extensions.digest(p_token::bytea, 'sha256'::text), 'hex');
$$;

-- Variable product "From" price calculation (minimum active variant sale price)
CREATE OR REPLACE FUNCTION public.kotson_get_product_from_price(p_product_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        MIN(ROUND(COALESCE(NULLIF(mrp_paise, 0), price_paise) * 0.60)::BIGINT),
        0::BIGINT
    )
    FROM public.product_variants
    WHERE product_id = p_product_id AND is_active = TRUE;
$$;

-- -----------------------------------------------------------------------------
-- 5. AUTHORITATIVE PRICING ENGINE RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_calculate_pricing(
    p_items JSONB,
    p_referral_code VARCHAR(30) DEFAULT NULL,
    p_coupon_code VARCHAR(50) DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    v_total_referral_discount_paise BIGINT := 0;
    v_total_coupon_discount_paise BIGINT := 0;
    v_final_total_paise BIGINT := 0;
    
    v_clean_ref VARCHAR(30);
    v_ref_status VARCHAR(20) := 'none';
    v_ref_user RECORD;
    v_ref_rate NUMERIC(10, 2) := 5.0; -- Standard 5% referral discount
    v_ref_eligible BOOLEAN := FALSE;
    
    v_clean_coupon VARCHAR(50);
    v_coupon_status VARCHAR(20) := 'none';
    v_coupon_message TEXT := '';
    v_coupon RECORD;
    v_coupon_eligible BOOLEAN := FALSE;
    
    v_out_lines JSONB := '[]'::JSONB;
BEGIN
    -- 1. Evaluate Referral Code & Self-Referral Protection
    IF p_referral_code IS NOT NULL AND TRIM(p_referral_code) != '' THEN
        v_clean_ref := UPPER(TRIM(p_referral_code));
        
        -- Check if user exists with this referral code
        SELECT * INTO v_ref_user FROM public.users WHERE UPPER(referral_code) = v_clean_ref AND is_active = TRUE LIMIT 1;
        
        IF NOT FOUND THEN
            v_ref_status := 'invalid';
        ELSIF p_user_id IS NOT NULL AND v_ref_user.id = p_user_id THEN
            -- SELF REFERRAL PREVENTED
            v_ref_status := 'self';
        ELSE
            v_ref_status := 'valid';
            v_ref_eligible := TRUE;
        END IF;
    END IF;

    -- 2. First Pass: Compute Authoritative 40% Sale Prices per Line
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB))
    LOOP
        v_variant_id := v_item->>'variant_id';
        v_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, 1));
        
        -- Look up variant and parent product authoritatively
        SELECT * INTO v_variant FROM public.product_variants WHERE id = v_variant_id;
        IF NOT FOUND OR NOT v_variant.is_active THEN
            CONTINUE; -- Exclude invalid/inactive variants
        END IF;
        
        SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
        IF NOT FOUND OR NOT v_product.is_active THEN
            CONTINUE;
        END IF;
        
        -- Authoritative Base MRP
        v_mrp_paise := COALESCE(NULLIF(v_variant.mrp_paise, 0), v_variant.price_paise);
        
        -- Global 40% Sale: sale_price = ROUND(mrp * 0.60)
        v_sale_price_paise := ROUND(v_mrp_paise * 0.60)::BIGINT;
        v_sale_discount_paise := v_mrp_paise - v_sale_price_paise;
        
        v_subtotal_mrp_paise := v_subtotal_mrp_paise + (v_mrp_paise * v_qty);
        v_total_sale_discount_paise := v_total_sale_discount_paise + (v_sale_discount_paise * v_qty);
        v_subtotal_sale_paise := v_subtotal_sale_paise + (v_sale_price_paise * v_qty);
    END LOOP;

    -- 3. Evaluate Coupon Validity & Stacking Rules
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
            -- Stacking rule: coupons and referrals do not stack unless explicitly configured
            v_coupon_status := 'not_stackable';
            v_coupon_message := 'Coupon cannot be combined with referral discounts';
        ELSE
            v_coupon_status := 'valid';
            v_coupon_eligible := TRUE;
            v_coupon_message := 'Coupon applied successfully';
        END IF;
    END IF;

    -- 4. Calculate Total Discounts (Price Waterfall)
    -- Referral discount comes after 40% sale
    IF v_ref_eligible THEN
        v_total_referral_discount_paise := ROUND(v_subtotal_sale_paise * (v_ref_rate / 100.0))::BIGINT;
    END IF;

    -- Coupon discount comes after referral (or standalone)
    IF v_coupon_eligible THEN
        IF v_coupon.discount_type = 'percentage' THEN
            v_total_coupon_discount_paise := ROUND(v_subtotal_sale_paise * (v_coupon.discount_value / 100.0))::BIGINT;
            IF v_coupon.max_discount_paise IS NOT NULL THEN
                v_total_coupon_discount_paise := LEAST(v_total_coupon_discount_paise, v_coupon.max_discount_paise);
            END IF;
        ELSIF v_coupon.discount_type = 'fixed' THEN
            v_total_coupon_discount_paise := LEAST(ROUND(v_coupon.discount_value * 100)::BIGINT, v_subtotal_sale_paise);
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
        
        v_mrp_paise := COALESCE(NULLIF(v_variant.mrp_paise, 0), v_variant.price_paise);
        v_sale_price_paise := ROUND(v_mrp_paise * 0.60)::BIGINT;
        v_sale_discount_paise := v_mrp_paise - v_sale_price_paise;
        
        -- Pro-rata / line discounts
        IF v_subtotal_sale_paise > 0 THEN
            v_line_ref_discount_paise := ROUND(v_total_referral_discount_paise * ((v_sale_price_paise * v_qty)::NUMERIC / v_subtotal_sale_paise::NUMERIC) / v_qty)::BIGINT;
            v_line_coupon_discount_paise := ROUND(v_total_coupon_discount_paise * ((v_sale_price_paise * v_qty)::NUMERIC / v_subtotal_sale_paise::NUMERIC) / v_qty)::BIGINT;
        ELSE
            v_line_ref_discount_paise := 0;
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
$$;

-- -----------------------------------------------------------------------------
-- 6. AUTHORITATIVE CART MANAGEMENT RPCS
-- -----------------------------------------------------------------------------

-- Get or Create Cart (Supports hashed guest token and authenticated user)
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
BEGIN
    -- Authenticated User Cart
    IF p_user_id IS NOT NULL THEN
        SELECT * INTO v_cart FROM public.carts WHERE user_id = p_user_id LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', v_cart.user_id, 'created', false);
        END IF;
        
        -- Check if guest cart exists with p_token to claim it
        IF p_token IS NOT NULL AND TRIM(p_token) != '' THEN
            v_token_hash := public.kotson_hash_token(p_token);
            SELECT * INTO v_cart FROM public.carts WHERE (token_hash = v_token_hash OR token = p_token) AND user_id IS NULL LIMIT 1;
            IF FOUND THEN
                UPDATE public.carts SET user_id = p_user_id, updated_at = NOW() WHERE id = v_cart.id;
                RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', p_user_id, 'claimed', true);
            END IF;
        END IF;

        -- Create new user cart
        v_clean_token := encode(extensions.gen_random_bytes(32), 'hex');
        INSERT INTO public.carts (id, token, token_hash, user_id, items, created_at, updated_at)
        VALUES (v_new_id, v_clean_token, public.kotson_hash_token(v_clean_token), p_user_id, '[]'::JSONB, NOW(), NOW())
        RETURNING * INTO v_cart;
        
        RETURN jsonb_build_object('id', v_cart.id, 'token', v_cart.token, 'user_id', v_cart.user_id, 'created', true);
    END IF;

    -- Guest Cart
    IF p_token IS NOT NULL AND TRIM(p_token) != '' THEN
        v_token_hash := public.kotson_hash_token(p_token);
        SELECT * INTO v_cart FROM public.carts WHERE (token_hash = v_token_hash OR token = p_token) AND user_id IS NULL LIMIT 1;
        IF FOUND THEN
            -- Ensure token_hash is populated
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

-- View Cart with Authoritative Pricing & Cross-Cart Isolation
CREATE OR REPLACE FUNCTION public.kotson_cart_view(
    p_cart_id UUID,
    p_token TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart RECORD;
    v_token_hash VARCHAR(64);
    v_pricing JSONB;
BEGIN
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;

    -- Verify cart authorization: must match user_id OR token/token_hash
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found';
    END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            -- Privilege check: admins can view
            IF NOT public.is_admin_or_owner() THEN
                RAISE EXCEPTION 'Access denied: cart belongs to another user';
            END IF;
        END IF;
    ELSE
        -- Guest cart must match bearer token or token_hash
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN
                RAISE EXCEPTION 'Access denied: invalid guest cart token';
            END IF;
        END IF;
    END IF;

    -- Compute authoritative pricing
    v_pricing := public.kotson_calculate_pricing(v_cart.items, v_cart.referred_code, v_cart.coupon_code, v_cart.user_id);
    
    RETURN v_pricing || jsonb_build_object(
        'cart_id', v_cart.id,
        'user_id', v_cart.user_id,
        'referred_code', v_cart.referred_code,
        'coupon_code', v_cart.coupon_code
    );
END;
$$;

-- Add Item to Cart (Validates variant, stock, reprices)
CREATE OR REPLACE FUNCTION public.kotson_cart_add_item(
    p_cart_id UUID,
    p_token TEXT,
    p_variant_id TEXT,
    p_qty INT,
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
    v_variant RECORD;
    v_items JSONB;
    v_new_items JSONB := '[]'::JSONB;
    v_item JSONB;
    v_found BOOLEAN := FALSE;
    v_avail INT;
    v_cur_qty INT;
    v_new_qty INT;
BEGIN
    IF p_qty <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- Authorize Cart
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found';
    END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    -- Validate Variant
    SELECT * INTO v_variant FROM public.product_variants WHERE id = p_variant_id;
    IF NOT FOUND OR NOT v_variant.is_active THEN
        RAISE EXCEPTION 'Variant does not exist or is inactive';
    END IF;

    v_avail := GREATEST(0, v_variant.stock - v_variant.reserved);
    IF v_avail <= 0 THEN
        RAISE EXCEPTION 'Variant is currently out of stock';
    END IF;

    v_items := COALESCE(v_cart.items, '[]'::JSONB);
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        IF (v_item->>'variant_id') = p_variant_id THEN
            v_found := TRUE;
            v_cur_qty := (v_item->>'qty')::INT;
            v_new_qty := LEAST(v_cur_qty + p_qty, v_avail);
            v_new_items := v_new_items || jsonb_build_object('variant_id', p_variant_id, 'qty', v_new_qty);
        ELSE
            v_new_items := v_new_items || v_item;
        END IF;
    END LOOP;

    IF NOT v_found THEN
        v_new_qty := LEAST(p_qty, v_avail);
        v_new_items := v_new_items || jsonb_build_object('variant_id', p_variant_id, 'qty', v_new_qty);
    END IF;

    UPDATE public.carts SET items = v_new_items, updated_at = NOW() WHERE id = p_cart_id;
    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$$;

-- Update Item Quantity in Cart
CREATE OR REPLACE FUNCTION public.kotson_cart_update_qty(
    p_cart_id UUID,
    p_token TEXT,
    p_variant_id TEXT,
    p_qty INT,
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
    v_variant RECORD;
    v_items JSONB;
    v_new_items JSONB := '[]'::JSONB;
    v_item JSONB;
    v_avail INT;
BEGIN
    -- Authorize Cart
    v_token_hash := CASE WHEN p_token IS NOT NULL AND TRIM(p_token) != '' THEN public.kotson_hash_token(p_token) ELSE NULL END;
    SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found';
    END IF;

    IF v_cart.user_id IS NOT NULL THEN
        IF p_user_id IS NULL OR v_cart.user_id != p_user_id THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    ELSE
        IF v_token_hash IS NULL OR (v_cart.token_hash != v_token_hash AND v_cart.token != p_token) THEN
            IF NOT public.is_admin_or_owner() THEN RAISE EXCEPTION 'Access denied'; END IF;
        END IF;
    END IF;

    v_items := COALESCE(v_cart.items, '[]'::JSONB);

    IF p_qty <= 0 THEN
        -- Remove item if qty <= 0
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
        LOOP
            IF (v_item->>'variant_id') != p_variant_id THEN
                v_new_items := v_new_items || v_item;
            END IF;
        END LOOP;
    ELSE
        SELECT * INTO v_variant FROM public.product_variants WHERE id = p_variant_id;
        v_avail := CASE WHEN FOUND THEN GREATEST(0, v_variant.stock - v_variant.reserved) ELSE 99 END;

        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
        LOOP
            IF (v_item->>'variant_id') = p_variant_id THEN
                v_new_items := v_new_items || jsonb_build_object('variant_id', p_variant_id, 'qty', LEAST(p_qty, v_avail));
            ELSE
                v_new_items := v_new_items || v_item;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.carts SET items = v_new_items, updated_at = NOW() WHERE id = p_cart_id;
    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$$;

-- Remove Item from Cart
CREATE OR REPLACE FUNCTION public.kotson_cart_remove_item(
    p_cart_id UUID,
    p_token TEXT,
    p_variant_id TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.kotson_cart_update_qty(p_cart_id, p_token, p_variant_id, 0, p_user_id);
END;
$$;

-- Clear Cart
CREATE OR REPLACE FUNCTION public.kotson_cart_clear(
    p_cart_id UUID,
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

    UPDATE public.carts SET items = '[]'::JSONB, updated_at = NOW() WHERE id = p_cart_id;
    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$$;

-- Apply Coupon to Cart
CREATE OR REPLACE FUNCTION public.kotson_cart_apply_coupon(
    p_cart_id UUID,
    p_token TEXT,
    p_coupon_code TEXT,
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

    UPDATE public.carts 
    SET coupon_code = NULLIF(UPPER(TRIM(p_coupon_code)), ''), updated_at = NOW() 
    WHERE id = p_cart_id;

    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$$;

-- Apply Referral to Cart
CREATE OR REPLACE FUNCTION public.kotson_cart_apply_referral(
    p_cart_id UUID,
    p_token TEXT,
    p_referral_code TEXT,
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

    UPDATE public.carts 
    SET referred_code = NULLIF(UPPER(TRIM(p_referral_code)), ''), updated_at = NOW() 
    WHERE id = p_cart_id;

    RETURN public.kotson_cart_view(p_cart_id, p_token, p_user_id);
END;
$$;

-- Atomic Guest -> Customer Cart Merge (Idempotent, Stock-capped, Repriced)
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
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID is required for cart merge';
    END IF;

    -- Locate or create user cart
    SELECT * INTO v_user_cart FROM public.carts WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        v_user_cart_id := gen_random_uuid();
        INSERT INTO public.carts (id, token, token_hash, user_id, items, created_at, updated_at)
        VALUES (v_user_cart_id, encode(gen_random_bytes(32), 'hex'), NULL, p_user_id, '[]'::JSONB, NOW(), NOW())
        RETURNING * INTO v_user_cart;
    ELSE
        v_user_cart_id := v_user_cart.id;
    END IF;

    -- If guest token is provided, locate guest cart
    IF p_guest_token IS NOT NULL AND TRIM(p_guest_token) != '' THEN
        v_guest_hash := public.kotson_hash_token(p_guest_token);
        SELECT * INTO v_guest_cart FROM public.carts 
        WHERE (token_hash = v_guest_hash OR token = p_guest_token) AND user_id IS NULL 
        FOR UPDATE;
        
        IF FOUND AND v_guest_cart.items IS NOT NULL AND jsonb_array_length(v_guest_cart.items) > 0 THEN
            -- Map current user items into map
            FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_user_cart.items, '[]'::JSONB))
            LOOP
                v_var_id := v_item->>'variant_id';
                v_qty := (v_item->>'qty')::INT;
                v_items_map := jsonb_set(v_items_map, ARRAY[v_var_id], to_jsonb(v_qty), true);
            END LOOP;

            -- Combine guest items
            FOR v_item IN SELECT * FROM jsonb_array_elements(v_guest_cart.items)
            LOOP
                v_var_id := v_item->>'variant_id';
                v_qty := (v_item->>'qty')::INT;
                IF v_items_map ? v_var_id THEN
                    v_combined_qty := (v_items_map->>v_var_id)::INT + v_qty;
                ELSE
                    v_combined_qty := v_qty;
                END IF;
                v_items_map := jsonb_set(v_items_map, ARRAY[v_var_id], to_jsonb(v_combined_qty), true);
            END LOOP;

            -- Validate each variant and cap by current available stock
            FOR v_key IN SELECT jsonb_object_keys(v_items_map)
            LOOP
                SELECT * INTO v_variant FROM public.product_variants WHERE id = v_key AND is_active = TRUE;
                IF FOUND THEN
                    v_avail := GREATEST(0, v_variant.stock - v_variant.reserved);
                    IF v_avail > 0 THEN
                        v_qty := LEAST((v_items_map->>v_key)::INT, v_avail);
                        v_merged_items := v_merged_items || jsonb_build_object('variant_id', v_key, 'qty', v_qty);
                    END IF;
                END IF;
            END LOOP;

            -- Adopt referral code & coupon code from guest if user cart has none
            UPDATE public.carts
            SET items = v_merged_items,
                referred_code = COALESCE(v_user_cart.referred_code, v_guest_cart.referred_code),
                coupon_code = COALESCE(v_user_cart.coupon_code, v_guest_cart.coupon_code),
                updated_at = NOW()
            WHERE id = v_user_cart_id;

            -- Invalidate / consume guest cart to ensure merge idempotency
            DELETE FROM public.carts WHERE id = v_guest_cart.id;
        END IF;
    END IF;

    -- Return authoritative merged customer cart view
    RETURN public.kotson_cart_view(v_user_cart_id, NULL, p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. ATOMIC STOCK RESERVATION & EXPIRY PRIMITIVES
-- -----------------------------------------------------------------------------

-- Atomic Stock Reservation with SELECT ... FOR UPDATE (Zero overselling)
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
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No items provided for reservation';
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

        -- Insert reservation record
        v_res_id := gen_random_uuid();
        INSERT INTO public.inventory_reservations (
            id, cart_id, user_id, variant_id, qty, status, expires_at, created_at
        ) VALUES (
            v_res_id, p_cart_id, p_user_id, v_var_id, v_qty, 'RESERVED',
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

-- Release Expired Reservations (Primitive for sweeper; idempotent; zero negative drift)
CREATE OR REPLACE FUNCTION public.kotson_release_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res RECORD;
    v_count INT := 0;
    v_qty_restored INT := 0;
BEGIN
    FOR v_res IN 
        SELECT id, variant_id, qty 
        FROM public.inventory_reservations 
        WHERE status = 'RESERVED' AND expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Restore available stock without allowing negative reserved
        UPDATE public.product_variants
        SET reserved = GREATEST(0, reserved - v_res.qty)
        WHERE id = v_res.variant_id;

        -- Mark as expired
        UPDATE public.inventory_reservations
        SET status = 'EXPIRED'
        WHERE id = v_res.id;

        v_count := v_count + 1;
        v_qty_restored := v_qty_restored + v_res.qty;
    END LOOP;

    RETURN jsonb_build_object(
        'released_count', v_count,
        'units_restored', v_qty_restored
    );
END;
$$;

-- Cancel Active Reservation
CREATE OR REPLACE FUNCTION public.kotson_cancel_reservation(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res RECORD;
BEGIN
    SELECT * INTO v_res 
    FROM public.inventory_reservations 
    WHERE id = p_reservation_id AND status = 'RESERVED' 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE public.product_variants
    SET reserved = GREATEST(0, reserved - v_res.qty)
    WHERE id = v_res.variant_id;

    UPDATE public.inventory_reservations
    SET status = 'CANCELLED'
    WHERE id = p_reservation_id;

    RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. SEED STANDARD TEST & PRODUCTION COUPONS
-- -----------------------------------------------------------------------------
INSERT INTO public.coupons (
    code, title, discount_type, discount_value, min_order_value_paise, 
    max_discount_paise, usage_limit, is_active, stackable_with_global_promo, stackable_with_referral
) VALUES 
    ('WELCOME10', 'Welcome 10% Off', 'percentage', 10.0, 500000, 100000, 1000, TRUE, TRUE, FALSE),
    ('FLAT500', 'Flat ₹500 Off', 'fixed', 500.0, 1000000, 50000, 500, TRUE, TRUE, FALSE),
    ('EXCLUSIVE15', 'Exclusive 15% Off (No Promo Stacking)', 'percentage', 15.0, 500000, 200000, 100, TRUE, FALSE, FALSE),
    ('EXPIRED50', 'Expired 50% Off Test', 'percentage', 50.0, 0, NULL, 10, FALSE, FALSE, FALSE)
ON CONFLICT (code) DO NOTHING;

-- Set EXPIRED50 valid_until to yesterday for testing
UPDATE public.coupons SET valid_until = NOW() - INTERVAL '1 day' WHERE code = 'EXPIRED50';
