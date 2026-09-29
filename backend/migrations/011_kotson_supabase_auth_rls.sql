-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 011
-- SUPABASE AUTH IDENTITY MAPPING, SECURE RBAC & ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Architecture & Trust Boundary Documentation:
-- 1. Establishes additive, durable identity mapping between auth.users.id and public.users.id.
-- 2. Preserves all historical primary keys, foreign keys, CRM leads, and PBKDF2 hashes.
-- 3. Implements production-grade RLS for customer self-service (addresses, own profile, orders, referrals, KYC).
-- 4. Guarantees cross-customer isolation and prevents role self-promotion via database triggers.
-- 5. Enables explicit, authorized access for Owner/Admin roles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADDITIVE IDENTITY MAPPING COLUMNS ON public.users
-- -----------------------------------------------------------------------------
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS supabase_auth_id UUID UNIQUE,
    ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON public.users(supabase_auth_id);

-- -----------------------------------------------------------------------------
-- 2. SECURE RBAC & IDENTITY HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
-- Resolve the application user ID from the Supabase Auth UID
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$;

-- Resolve the application user referral code from the Supabase Auth UID
CREATE OR REPLACE FUNCTION public.get_current_user_referral_code()
RETURNS VARCHAR(30)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT referral_code FROM public.users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$;

-- Check if the current authenticated user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE supabase_auth_id = auth.uid()
          AND is_active = TRUE
          AND required_role = ANY(roles)
    );
$$;

-- Check if the current user is an Owner or Admin
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE supabase_auth_id = auth.uid()
          AND is_active = TRUE
          AND (roles && ARRAY['owner', 'admin']::TEXT[])
    );
$$;

-- Check if the current user is internal staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE supabase_auth_id = auth.uid()
          AND is_active = TRUE
          AND (roles && ARRAY['owner', 'admin', 'manager', 'crm_master', 'crm_manager', 'crm_employee', 'stock_point_manager']::TEXT[])
    );
$$;

-- -----------------------------------------------------------------------------
-- 3. PRIVILEGE ESCALATION & FIELD TAMPERING GUARDS (Trigger)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only restrict authenticated non-admin/owner callers
    IF (auth.role() = 'authenticated') AND NOT public.is_admin_or_owner() THEN
        IF NEW.roles IS DISTINCT FROM OLD.roles THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their own roles.';
        END IF;
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify account active status.';
        END IF;
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: User ID is immutable.';
        END IF;
        IF NEW.supabase_auth_id IS DISTINCT FROM OLD.supabase_auth_id THEN
            RAISE EXCEPTION 'Unauthorized: Supabase Auth ID is immutable.';
        END IF;
        IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
            RAISE EXCEPTION 'Unauthorized: Referral code is immutable.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_fields ON public.users;
CREATE TRIGGER trg_protect_user_fields
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_fields();

-- -----------------------------------------------------------------------------
-- 4. PRODUCTION-GRADE RLS POLICIES
-- -----------------------------------------------------------------------------

-- --- public.users ---
DROP POLICY IF EXISTS "customer_select_own_user" ON public.users;
CREATE POLICY "customer_select_own_user" ON public.users
    FOR SELECT USING (
        supabase_auth_id = auth.uid() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "customer_update_own_user" ON public.users;
CREATE POLICY "customer_update_own_user" ON public.users
    FOR UPDATE USING (
        supabase_auth_id = auth.uid() OR public.is_admin_or_owner()
    )
    WITH CHECK (
        supabase_auth_id = auth.uid() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "admin_all_users" ON public.users;
CREATE POLICY "admin_all_users" ON public.users
    FOR ALL USING (
        public.is_admin_or_owner()
    );

-- --- public.user_addresses ---
DROP POLICY IF EXISTS "customer_select_own_addresses" ON public.user_addresses;
CREATE POLICY "customer_select_own_addresses" ON public.user_addresses
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "customer_insert_own_addresses" ON public.user_addresses;
CREATE POLICY "customer_insert_own_addresses" ON public.user_addresses
    FOR INSERT WITH CHECK (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "customer_update_own_addresses" ON public.user_addresses;
CREATE POLICY "customer_update_own_addresses" ON public.user_addresses
    FOR UPDATE USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    )
    WITH CHECK (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "customer_delete_own_addresses" ON public.user_addresses;
CREATE POLICY "customer_delete_own_addresses" ON public.user_addresses
    FOR DELETE USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "admin_all_addresses" ON public.user_addresses;
CREATE POLICY "admin_all_addresses" ON public.user_addresses
    FOR ALL USING (
        public.is_admin_or_owner()
    );

-- --- public.orders ---
DROP POLICY IF EXISTS "customer_select_own_orders" ON public.orders;
CREATE POLICY "customer_select_own_orders" ON public.orders
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "admin_all_orders" ON public.orders;
CREATE POLICY "admin_all_orders" ON public.orders
    FOR ALL USING (
        public.is_admin_or_owner()
    );

-- --- public.referral_attributions ---
DROP POLICY IF EXISTS "customer_select_own_referral_attributions" ON public.referral_attributions;
CREATE POLICY "customer_select_own_referral_attributions" ON public.referral_attributions
    FOR SELECT USING (
        customer_id = public.get_current_user_id()
        OR code = public.get_current_user_referral_code()
        OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "admin_all_referral_attributions" ON public.referral_attributions;
CREATE POLICY "admin_all_referral_attributions" ON public.referral_attributions
    FOR ALL USING (
        public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "service_role_all_referral_attributions" ON public.referral_attributions;
CREATE POLICY "service_role_all_referral_attributions" ON public.referral_attributions
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- --- public.referral_rewards ---
DROP POLICY IF EXISTS "customer_select_own_referral_rewards" ON public.referral_rewards;
CREATE POLICY "customer_select_own_referral_rewards" ON public.referral_rewards
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "admin_all_referral_rewards" ON public.referral_rewards;
CREATE POLICY "admin_all_referral_rewards" ON public.referral_rewards
    FOR ALL USING (
        public.is_admin_or_owner()
    );

-- --- public.kyc_records ---
DROP POLICY IF EXISTS "customer_select_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_select_own_kyc" ON public.kyc_records
    FOR SELECT USING (
        user_id = public.get_current_user_id() OR public.is_admin_or_owner()
    );

DROP POLICY IF EXISTS "customer_insert_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_insert_own_kyc" ON public.kyc_records
    FOR INSERT WITH CHECK (
        user_id = public.get_current_user_id()
    );

DROP POLICY IF EXISTS "customer_update_own_kyc" ON public.kyc_records;
CREATE POLICY "customer_update_own_kyc" ON public.kyc_records
    FOR UPDATE USING (
        user_id = public.get_current_user_id() AND status IN ('PENDING', 'REJECTED')
    )
    WITH CHECK (
        user_id = public.get_current_user_id()
    );

DROP POLICY IF EXISTS "admin_all_kyc" ON public.kyc_records;
CREATE POLICY "admin_all_kyc" ON public.kyc_records
    FOR ALL USING (
        public.is_admin_or_owner()
    );

-- -----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTIONS FOR IDENTITY MIGRATION & AUTH BRIDGE
-- -----------------------------------------------------------------------------

-- Atomic Identity Link RPC
CREATE OR REPLACE FUNCTION public.kotson_link_supabase_auth(
    p_user_id UUID,
    p_supabase_auth_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- If already linked to another supabase_auth_id, prevent conflict
    IF v_user.supabase_auth_id IS NOT NULL AND v_user.supabase_auth_id != p_supabase_auth_id THEN
        RAISE EXCEPTION 'User already linked to another Supabase Auth identity';
    END IF;

    UPDATE public.users
    SET supabase_auth_id = p_supabase_auth_id,
        migrated_at = COALESCE(migrated_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'supabase_auth_id', p_supabase_auth_id
    );
END;
$$;

-- Atomic User Registration RPC
CREATE OR REPLACE FUNCTION public.kotson_register_customer(
    p_user_id UUID,
    p_email VARCHAR(255),
    p_phone VARCHAR(30),
    p_name VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_supabase_auth_id UUID,
    p_referral_code VARCHAR(30),
    p_referred_by VARCHAR(30) DEFAULT NULL,
    p_consent JSONB DEFAULT '{"agreed": true, "terms_and_privacy": true, "version": "2026-v1"}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_user RECORD;
BEGIN
    -- Ensure uniqueness
    IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email already registered';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE phone = p_phone) THEN
        RAISE EXCEPTION 'Phone number already registered';
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE referral_code = p_referral_code) THEN
        RAISE EXCEPTION 'Referral code collision';
    END IF;

    INSERT INTO public.users (
        id,
        email,
        phone,
        name,
        password_hash,
        roles,
        referral_code,
        referred_by,
        phone_verified,
        phone_verified_at,
        phone_verification_provider,
        is_active,
        consent,
        supabase_auth_id,
        migrated_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_email,
        p_phone,
        p_name,
        p_password_hash,
        ARRAY['customer']::TEXT[],
        p_referral_code,
        p_referred_by,
        TRUE,
        NOW(),
        'MSG91',
        TRUE,
        p_consent,
        p_supabase_auth_id,
        NOW(),
        NOW(),
        NOW()
    ) RETURNING * INTO v_new_user;

    RETURN jsonb_build_object(
        'id', v_new_user.id,
        'email', v_new_user.email,
        'phone', v_new_user.phone,
        'name', v_new_user.name,
        'roles', v_new_user.roles,
        'referral_code', v_new_user.referral_code,
        'supabase_auth_id', v_new_user.supabase_auth_id
    );
END;
$$;
