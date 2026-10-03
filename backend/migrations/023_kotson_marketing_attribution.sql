-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 023
-- OWNER ADMIN MARKETING CAMPAIGNS & UTM ATTRIBUTION ENGINE
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. MARKETING CAMPAIGNS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(100) NOT NULL CHECK (campaign_type IN ('Influencer', 'Meta Ads', 'Google Ads', 'YouTube', 'Instagram', 'Partner', 'Offline/QR', 'Other')),
    utm_source VARCHAR(100) NOT NULL,
    utm_medium VARCHAR(100) NOT NULL,
    utm_campaign VARCHAR(100) NOT NULL,
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    influencer_name VARCHAR(255),
    destination_url TEXT NOT NULL DEFAULT 'https://www.kotsonbeds.com/',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_code ON public.marketing_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_type ON public.marketing_campaigns(campaign_type);

-- -----------------------------------------------------------------------------
-- 2. MARKETING LINKS TABLE (Trackable opaque links)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
    link_code VARCHAR(100) UNIQUE NOT NULL,
    utm_source VARCHAR(100) NOT NULL,
    utm_medium VARCHAR(100) NOT NULL,
    utm_campaign VARCHAR(100) NOT NULL,
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    full_url TEXT NOT NULL,
    clicks_count BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_links_code ON public.marketing_links(link_code);
CREATE INDEX IF NOT EXISTS idx_marketing_links_campaign ON public.marketing_links(campaign_id);

-- -----------------------------------------------------------------------------
-- 3. MARKETING CLICKS TABLE (First-Party Click Events)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    link_id UUID REFERENCES public.marketing_links(id) ON DELETE SET NULL,
    visitor_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    landing_page TEXT,
    referrer TEXT,
    device_category VARCHAR(50) DEFAULT 'desktop',
    user_agent TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_clicks_visitor ON public.marketing_clicks(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_clicks_campaign ON public.marketing_clicks(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_clicks_link ON public.marketing_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_marketing_clicks_user ON public.marketing_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_clicks_created ON public.marketing_clicks(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. CUSTOMER ATTRIBUTION TABLE (First-Touch & Last-Touch)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    visitor_id VARCHAR(100),
    first_touch_link_id UUID REFERENCES public.marketing_links(id) ON DELETE SET NULL,
    first_touch_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    first_touch_source VARCHAR(100) NOT NULL DEFAULT 'Direct / Organic',
    first_touch_medium VARCHAR(100) DEFAULT 'direct',
    first_touch_campaign VARCHAR(100) DEFAULT 'none',
    first_touch_content VARCHAR(100),
    first_touch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_touch_link_id UUID REFERENCES public.marketing_links(id) ON DELETE SET NULL,
    last_touch_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    last_touch_source VARCHAR(100) NOT NULL DEFAULT 'Direct / Organic',
    last_touch_medium VARCHAR(100) DEFAULT 'direct',
    last_touch_campaign VARCHAR(100) DEFAULT 'none',
    last_touch_content VARCHAR(100),
    last_touch_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    lead_status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_attr_user ON public.customer_attribution(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_attr_visitor ON public.customer_attribution(visitor_id);
CREATE INDEX IF NOT EXISTS idx_customer_attr_first_camp ON public.customer_attribution(first_touch_campaign_id);
CREATE INDEX IF NOT EXISTS idx_customer_attr_last_camp ON public.customer_attribution(last_touch_campaign_id);
CREATE INDEX IF NOT EXISTS idx_customer_attr_assignee ON public.customer_attribution(assigned_employee_id);

-- -----------------------------------------------------------------------------
-- 5. ORDER ATTRIBUTION SNAPSHOT TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    first_touch_link_id UUID REFERENCES public.marketing_links(id) ON DELETE SET NULL,
    first_touch_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    first_touch_source VARCHAR(100),
    first_touch_medium VARCHAR(100),
    first_touch_campaign VARCHAR(100),
    last_touch_link_id UUID REFERENCES public.marketing_links(id) ON DELETE SET NULL,
    last_touch_campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
    last_touch_source VARCHAR(100),
    last_touch_medium VARCHAR(100),
    last_touch_campaign VARCHAR(100),
    order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_attr_order ON public.order_attribution(order_id);
CREATE INDEX IF NOT EXISTS idx_order_attr_user ON public.order_attribution(user_id);
CREATE INDEX IF NOT EXISTS idx_order_attr_last_camp ON public.order_attribution(last_touch_campaign_id);
CREATE INDEX IF NOT EXISTS idx_order_attr_first_camp ON public.order_attribution(first_touch_campaign_id);

-- -----------------------------------------------------------------------------
-- 6. LEAD ASSIGNMENT HISTORY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_lead_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    previous_assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    new_assignee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_assign_user ON public.marketing_lead_assignments(user_id);

-- -----------------------------------------------------------------------------
-- 7. AUDIT LOGS FOR MARKETING CAMPAIGNS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_audit_created ON public.marketing_audit_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_audit_logs ENABLE ROW LEVEL SECURITY;

-- Anonymous click insertion policy for click tracking
DROP POLICY IF EXISTS "public_insert_clicks" ON public.marketing_clicks;
CREATE POLICY "public_insert_clicks" ON public.marketing_clicks
    FOR INSERT WITH CHECK (true);

-- Read policies for marketing tables: Admin/Owner or service_role
DROP POLICY IF EXISTS "admin_marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "admin_marketing_campaigns" ON public.marketing_campaigns
    FOR ALL USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "admin_marketing_links" ON public.marketing_links;
CREATE POLICY "admin_marketing_links" ON public.marketing_links
    FOR ALL USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "admin_marketing_clicks" ON public.marketing_clicks;
CREATE POLICY "admin_marketing_clicks" ON public.marketing_clicks
    FOR SELECT USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "staff_customer_attribution" ON public.customer_attribution;
CREATE POLICY "staff_customer_attribution" ON public.customer_attribution
    FOR ALL USING (
        public.is_admin_or_owner() 
        OR (auth.jwt() ->> 'role') = 'service_role' 
        OR assigned_employee_id = auth.uid()
    );

DROP POLICY IF EXISTS "admin_order_attribution" ON public.order_attribution;
CREATE POLICY "admin_order_attribution" ON public.order_attribution
    FOR ALL USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "admin_lead_assignments" ON public.marketing_lead_assignments;
CREATE POLICY "admin_lead_assignments" ON public.marketing_lead_assignments
    FOR ALL USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "admin_mkt_audit_logs" ON public.marketing_audit_logs;
CREATE POLICY "admin_mkt_audit_logs" ON public.marketing_audit_logs
    FOR ALL USING (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role');

-- -----------------------------------------------------------------------------
-- 9. CLICK RECORDING RPC (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_record_marketing_click(
    p_visitor_id VARCHAR(100),
    p_kt_campaign VARCHAR(100) DEFAULT NULL,
    p_utm_source VARCHAR(100) DEFAULT NULL,
    p_utm_medium VARCHAR(100) DEFAULT NULL,
    p_utm_campaign VARCHAR(100) DEFAULT NULL,
    p_utm_content VARCHAR(100) DEFAULT NULL,
    p_utm_term VARCHAR(100) DEFAULT NULL,
    p_landing_page TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_device_category VARCHAR(50) DEFAULT 'desktop',
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link RECORD;
    v_campaign RECORD;
    v_campaign_id UUID := NULL;
    v_link_id UUID := NULL;
    v_user_id UUID := auth.uid();
    v_recent_click_count INT := 0;
    v_clean_source VARCHAR(100);
    v_clean_medium VARCHAR(100);
    v_clean_campaign VARCHAR(100);
BEGIN
    IF p_visitor_id IS NULL OR TRIM(p_visitor_id) = '' THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'missing_visitor_id');
    END IF;

    -- Sanitize/clean UTM strings
    v_clean_source := TRIM(REGEXP_REPLACE(COALESCE(p_utm_source, ''), '[<>]', '', 'g'));
    v_clean_medium := TRIM(REGEXP_REPLACE(COALESCE(p_utm_medium, ''), '[<>]', '', 'g'));
    v_clean_campaign := TRIM(REGEXP_REPLACE(COALESCE(p_utm_campaign, ''), '[<>]', '', 'g'));

    -- 1. Try resolving opaque kt_campaign link code first
    IF p_kt_campaign IS NOT NULL AND TRIM(p_kt_campaign) <> '' THEN
        SELECT l.*, c.status as campaign_status INTO v_link
        FROM public.marketing_links l
        JOIN public.marketing_campaigns c ON c.id = l.campaign_id
        WHERE l.link_code = TRIM(p_kt_campaign) AND l.status = 'active';

        IF FOUND THEN
            v_link_id := v_link.id;
            v_campaign_id := v_link.campaign_id;
            v_clean_source := COALESCE(v_clean_source, v_link.utm_source);
            v_clean_medium := COALESCE(v_clean_medium, v_link.utm_medium);
            v_clean_campaign := COALESCE(v_clean_campaign, v_link.utm_campaign);
        END IF;
    END IF;

    -- 2. If link ID not found by kt_campaign, search active campaign by UTM matching
    IF v_campaign_id IS NULL AND v_clean_source <> '' AND v_clean_campaign <> '' THEN
        SELECT * INTO v_campaign
        FROM public.marketing_campaigns
        WHERE LOWER(utm_source) = LOWER(v_clean_source)
          AND LOWER(utm_campaign) = LOWER(v_clean_campaign)
          AND status = 'active'
        LIMIT 1;

        IF FOUND THEN
            v_campaign_id := v_campaign.id;
        END IF;
    END IF;

    -- If no valid attributable source/campaign exists, ignore tracking
    IF v_campaign_id IS NULL AND (v_clean_source = '' OR v_clean_campaign = '') THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'no_valid_utm_or_campaign');
    END IF;

    -- Refresh / Bot Click Deduplication: Ignore identical click from same visitor in last 3 seconds
    SELECT COUNT(*) INTO v_recent_click_count
    FROM public.marketing_clicks
    WHERE visitor_id = p_visitor_id
      AND created_at > (NOW() - INTERVAL '3 seconds');

    IF v_recent_click_count > 0 THEN
        RETURN jsonb_build_object('recorded', false, 'reason', 'deduplicated_rapid_click');
    END IF;

    -- 3. Record Click Event
    INSERT INTO public.marketing_clicks (
        campaign_id, link_id, visitor_id, user_id,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        landing_page, referrer, device_category, user_agent
    ) VALUES (
        v_campaign_id, v_link_id, p_visitor_id, v_user_id,
        v_clean_source, v_clean_medium, v_clean_campaign, p_utm_content, p_utm_term,
        p_landing_page, p_referrer, p_device_category, p_user_agent
    );

    -- Increment Link counter if link matched
    IF v_link_id IS NOT NULL THEN
        UPDATE public.marketing_links SET clicks_count = clicks_count + 1 WHERE id = v_link_id;
    END IF;

    -- 4. If visitor is already authenticated, update customer attribution
    IF v_user_id IS NOT NULL THEN
        PERFORM public.kotson_sync_customer_attribution(
            v_user_id,
            p_visitor_id,
            v_clean_source,
            v_clean_medium,
            v_clean_campaign,
            p_utm_content,
            v_campaign_id,
            v_link_id
        );
    END IF;

    RETURN jsonb_build_object(
        'recorded', true,
        'visitor_id', p_visitor_id,
        'campaign_id', v_campaign_id,
        'link_id', v_link_id,
        'source', v_clean_source,
        'campaign', v_clean_campaign
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. CUSTOMER ATTRIBUTION SYNC RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_sync_customer_attribution(
    p_user_id UUID,
    p_visitor_id VARCHAR(100) DEFAULT NULL,
    p_utm_source VARCHAR(100) DEFAULT NULL,
    p_utm_medium VARCHAR(100) DEFAULT NULL,
    p_utm_campaign VARCHAR(100) DEFAULT NULL,
    p_utm_content VARCHAR(100) DEFAULT NULL,
    p_campaign_id UUID DEFAULT NULL,
    p_link_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_earliest_click RECORD;
    v_source VARCHAR(100);
    v_medium VARCHAR(100);
    v_campaign VARCHAR(100);
    v_content VARCHAR(100);
    v_camp_id UUID;
    v_link_id UUID;
    v_click_time TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'null_user_id');
    END IF;

    SELECT * INTO v_existing FROM public.customer_attribution WHERE user_id = p_user_id FOR UPDATE;

    -- Resolve click lineage if explicit params missing
    IF (p_utm_source IS NULL OR p_utm_source = '') AND p_visitor_id IS NOT NULL THEN
        SELECT * INTO v_earliest_click
        FROM public.marketing_clicks
        WHERE visitor_id = p_visitor_id AND utm_source IS NOT NULL AND utm_source <> ''
        ORDER BY created_at ASC
        LIMIT 1;

        IF FOUND THEN
            v_source := v_earliest_click.utm_source;
            v_medium := v_earliest_click.utm_medium;
            v_campaign := v_earliest_click.utm_campaign;
            v_content := v_earliest_click.utm_content;
            v_camp_id := v_earliest_click.campaign_id;
            v_link_id := v_earliest_click.link_id;
            v_click_time := v_earliest_click.created_at;
        END IF;
    ELSE
        v_source := p_utm_source;
        v_medium := p_utm_medium;
        v_campaign := p_utm_campaign;
        v_content := p_utm_content;
        v_camp_id := p_campaign_id;
        v_link_id := p_link_id;
        v_click_time := NOW();
    END IF;

    -- Fallback to Direct/Organic if still empty
    v_source := COALESCE(NULLIF(TRIM(v_source), ''), 'Direct / Organic');
    v_medium := COALESCE(NULLIF(TRIM(v_medium), ''), 'direct');
    v_campaign := COALESCE(NULLIF(TRIM(v_campaign), ''), 'none');

    IF NOT FOUND THEN
        -- FIRST TOUCH: Established ONCE and NEVER overwritten!
        INSERT INTO public.customer_attribution (
            user_id, visitor_id,
            first_touch_link_id, first_touch_campaign_id, first_touch_source, first_touch_medium, first_touch_campaign, first_touch_content, first_touch_timestamp,
            last_touch_link_id, last_touch_campaign_id, last_touch_source, last_touch_medium, last_touch_campaign, last_touch_content, last_touch_timestamp,
            lead_status, created_at, updated_at
        ) VALUES (
            p_user_id, p_visitor_id,
            v_link_id, v_camp_id, v_source, v_medium, v_campaign, v_content, COALESCE(v_click_time, NOW()),
            v_link_id, v_camp_id, v_source, v_medium, v_campaign, v_content, NOW(),
            'NEW', NOW(), NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    ELSE
        -- LAST TOUCH: Updated if valid new attributable campaign visit arrives
        IF v_source <> 'Direct / Organic' AND v_source <> '' THEN
            UPDATE public.customer_attribution
            SET last_touch_link_id = COALESCE(v_link_id, last_touch_link_id),
                last_touch_campaign_id = COALESCE(v_camp_id, last_touch_campaign_id),
                last_touch_source = v_source,
                last_touch_medium = v_medium,
                last_touch_campaign = v_campaign,
                last_touch_content = COALESCE(v_content, last_touch_content),
                last_touch_timestamp = NOW(),
                visitor_id = COALESCE(p_visitor_id, visitor_id),
                updated_at = NOW()
            WHERE user_id = p_user_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. ORDER ATTRIBUTION SNAPSHOT HELPER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_snapshot_order_attribution(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        COALESCE(v_order.total_amount, 0), 'PAID', NOW()
    )
    ON CONFLICT (order_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. UPDATE kotson_payment_success TO SNAPSHOT ATTRIBUTION ATOMICALLY
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

    -- 7. CRITICAL: Snapshot Marketing Attribution onto Order
    PERFORM public.kotson_snapshot_order_attribution(v_order.id);

    RETURN jsonb_build_object(
        'status', 'paid',
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'idempotent', false
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. OWNER ADMIN MARKETING DASHBOARD METRICS RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_marketing_dashboard(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end TIMESTAMPTZ := COALESCE(p_end_date, NOW());
    v_total_campaigns INT := 0;
    v_total_links INT := 0;
    v_total_clicks BIGINT := 0;
    v_unique_visitors BIGINT := 0;
    v_signups BIGINT := 0;
    v_purchasers BIGINT := 0;
    v_orders BIGINT := 0;
    v_revenue NUMERIC(12, 2) := 0;
    v_click_to_signup NUMERIC(5, 2) := 0;
    v_signup_to_purchase NUMERIC(5, 2) := 0;
    v_click_to_purchase NUMERIC(5, 2) := 0;
    v_rev_per_campaign NUMERIC(12, 2) := 0;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied. Owner Admin privilege required.';
    END IF;

    SELECT COUNT(*) INTO v_total_campaigns FROM public.marketing_campaigns;
    SELECT COUNT(*) INTO v_total_links FROM public.marketing_links;

    SELECT COUNT(*), COUNT(DISTINCT visitor_id)
    INTO v_total_clicks, v_unique_visitors
    FROM public.marketing_clicks
    WHERE created_at BETWEEN v_start AND v_end;

    SELECT COUNT(DISTINCT user_id)
    INTO v_signups
    FROM public.customer_attribution
    WHERE created_at BETWEEN v_start AND v_end
      AND first_touch_source <> 'Direct / Organic';

    SELECT COUNT(DISTINCT user_id), COUNT(*), COALESCE(SUM(order_amount), 0)
    INTO v_purchasers, v_orders, v_revenue
    FROM public.order_attribution
    WHERE created_at BETWEEN v_start AND v_end;

    IF v_total_clicks > 0 THEN
        v_click_to_signup := ROUND((v_signups::NUMERIC / v_total_clicks::NUMERIC) * 100, 2);
        v_click_to_purchase := ROUND((v_purchasers::NUMERIC / v_total_clicks::NUMERIC) * 100, 2);
    END IF;

    IF v_signups > 0 THEN
        v_signup_to_purchase := ROUND((v_purchasers::NUMERIC / v_signups::NUMERIC) * 100, 2);
    END IF;

    IF v_total_campaigns > 0 THEN
        v_rev_per_campaign := ROUND(v_revenue / v_total_campaigns::NUMERIC, 2);
    END IF;

    RETURN jsonb_build_object(
        'total_campaigns', v_total_campaigns,
        'total_links', v_total_links,
        'total_clicks', v_total_clicks,
        'unique_visitors', v_unique_visitors,
        'signups', v_signups,
        'purchasers', v_purchasers,
        'orders', v_orders,
        'revenue', v_revenue,
        'click_to_signup_pct', v_click_to_signup,
        'signup_to_purchase_pct', v_signup_to_purchase,
        'click_to_purchase_pct', v_click_to_purchase,
        'revenue_per_campaign', v_rev_per_campaign
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. CAMPAIGN PERFORMANCE LIST RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_campaign_performance(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_start TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end TIMESTAMPTZ := COALESCE(p_end_date, NOW());
    v_res JSONB;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied. Owner Admin privilege required.';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_res
    FROM (
        SELECT 
            c.id,
            c.code,
            c.name,
            c.campaign_type,
            c.utm_source,
            c.utm_medium,
            c.utm_campaign,
            c.influencer_name,
            c.destination_url,
            c.status,
            c.created_at,
            COALESCE(clk.clicks_count, 0) as clicks,
            COALESCE(clk.unique_visitors, 0) as unique_visitors,
            COALESCE(sub.signups, 0) as signups,
            COALESCE(ord.purchasers, 0) as purchasers,
            COALESCE(ord.orders, 0) as orders,
            COALESCE(ord.revenue, 0) as revenue,
            CASE WHEN COALESCE(clk.clicks_count, 0) > 0 
                 THEN ROUND((COALESCE(sub.signups, 0)::NUMERIC / clk.clicks_count::NUMERIC) * 100, 2)
                 ELSE 0 END as signup_pct,
            CASE WHEN COALESCE(sub.signups, 0) > 0 
                 THEN ROUND((COALESCE(ord.purchasers, 0)::NUMERIC / sub.signups::NUMERIC) * 100, 2)
                 ELSE 0 END as purchase_pct
        FROM public.marketing_campaigns c
        LEFT JOIN (
            SELECT campaign_id, COUNT(*) as clicks_count, COUNT(DISTINCT visitor_id) as unique_visitors
            FROM public.marketing_clicks
            WHERE created_at BETWEEN v_start AND v_end
            GROUP BY campaign_id
        ) clk ON clk.campaign_id = c.id
        LEFT JOIN (
            SELECT first_touch_campaign_id, COUNT(DISTINCT user_id) as signups
            FROM public.customer_attribution
            WHERE created_at BETWEEN v_start AND v_end
            GROUP BY first_touch_campaign_id
        ) sub ON sub.first_touch_campaign_id = c.id
        LEFT JOIN (
            SELECT last_touch_campaign_id, COUNT(DISTINCT user_id) as purchasers, COUNT(*) as orders, SUM(order_amount) as revenue
            FROM public.order_attribution
            WHERE created_at BETWEEN v_start AND v_end
            GROUP BY last_touch_campaign_id
        ) ord ON ord.last_touch_campaign_id = c.id
        ORDER BY c.created_at DESC
    ) t;

    RETURN v_res;
END;
$$;

-- -----------------------------------------------------------------------------
-- 15. CREATE CAMPAIGN RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_create_campaign(
    p_name VARCHAR(255),
    p_campaign_type VARCHAR(100),
    p_utm_source VARCHAR(100),
    p_utm_medium VARCHAR(100),
    p_utm_campaign VARCHAR(100),
    p_utm_content VARCHAR(100) DEFAULT NULL,
    p_utm_term VARCHAR(100) DEFAULT NULL,
    p_influencer_name VARCHAR(255) DEFAULT NULL,
    p_destination_url TEXT DEFAULT 'https://www.kotsonbeds.com/'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code VARCHAR(100);
    v_link_code VARCHAR(100);
    v_camp_id UUID;
    v_link_id UUID;
    v_clean_url TEXT;
    v_full_url TEXT;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied. Owner Admin privilege required.';
    END IF;

    v_code := 'CMP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    v_link_code := 'cmp_' || LOWER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10));
    v_clean_url := COALESCE(NULLIF(TRIM(p_destination_url), ''), 'https://www.kotsonbeds.com/');

    INSERT INTO public.marketing_campaigns (
        code, name, campaign_type, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        influencer_name, destination_url, status, created_by
    ) VALUES (
        v_code, TRIM(p_name), p_campaign_type, TRIM(p_utm_source), TRIM(p_utm_medium), TRIM(p_utm_campaign),
        TRIM(p_utm_content), TRIM(p_utm_term), TRIM(p_influencer_name), v_clean_url, 'active', auth.uid()
    )
    RETURNING id INTO v_camp_id;

    -- Construct authoritative trackable URL with opaque kt_campaign parameter
    v_full_url := v_clean_url || 
        (CASE WHEN v_clean_url LIKE '%?%' THEN '&' ELSE '?' END) ||
        'utm_source=' || LOWER(TRIM(p_utm_source)) ||
        '&utm_medium=' || LOWER(TRIM(p_utm_medium)) ||
        '&utm_campaign=' || LOWER(TRIM(p_utm_campaign)) ||
        (CASE WHEN p_utm_content IS NOT NULL AND TRIM(p_utm_content) <> '' THEN '&utm_content=' || LOWER(TRIM(p_utm_content)) ELSE '' END) ||
        (CASE WHEN p_utm_term IS NOT NULL AND TRIM(p_utm_term) <> '' THEN '&utm_term=' || LOWER(TRIM(p_utm_term)) ELSE '' END) ||
        '&kt_campaign=' || v_link_code;

    INSERT INTO public.marketing_links (
        campaign_id, link_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, full_url, status
    ) VALUES (
        v_camp_id, v_link_code, TRIM(p_utm_source), TRIM(p_utm_medium), TRIM(p_utm_campaign),
        TRIM(p_utm_content), TRIM(p_utm_term), v_full_url, 'active'
    )
    RETURNING id INTO v_link_id;

    -- Audit logging
    INSERT INTO public.marketing_audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'CAMPAIGN_CREATED', 'marketing_campaigns', v_camp_id::TEXT, jsonb_build_object(
        'name', p_name,
        'code', v_code,
        'link_code', v_link_code,
        'full_url', v_full_url
    ));

    RETURN jsonb_build_object(
        'campaign_id', v_camp_id,
        'link_id', v_link_id,
        'code', v_code,
        'link_code', v_link_code,
        'full_url', v_full_url
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 16. ATTRIBUTION REPORT & LEADS RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_get_attribution_report(
    p_campaign_id UUID DEFAULT NULL,
    p_source VARCHAR(100) DEFAULT NULL,
    p_medium VARCHAR(100) DEFAULT NULL,
    p_search VARCHAR(255) DEFAULT NULL,
    p_assigned_employee_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 25,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total BIGINT := 0;
    v_leads JSONB;
BEGIN
    IF NOT (public.is_admin_or_owner() OR (auth.jwt() ->> 'role') = 'service_role') THEN
        -- Allow assigned staff to read their own assigned leads
        IF p_assigned_employee_id IS NULL OR p_assigned_employee_id <> auth.uid() THEN
            RAISE EXCEPTION 'Access denied';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.customer_attribution ca
    JOIN public.users u ON u.id = ca.user_id
    WHERE (p_campaign_id IS NULL OR ca.first_touch_campaign_id = p_campaign_id OR ca.last_touch_campaign_id = p_campaign_id)
      AND (p_source IS NULL OR LOWER(ca.first_touch_source) = LOWER(p_source) OR LOWER(ca.last_touch_source) = LOWER(p_source))
      AND (p_medium IS NULL OR LOWER(ca.first_touch_medium) = LOWER(p_medium) OR LOWER(ca.last_touch_medium) = LOWER(p_medium))
      AND (p_assigned_employee_id IS NULL OR ca.assigned_employee_id = p_assigned_employee_id)
      AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%' OR u.phone ILIKE '%' || p_search || '%');

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_leads
    FROM (
        SELECT 
            ca.id as attribution_id,
            u.id as customer_id,
            u.name as customer_name,
            u.phone,
            u.email,
            u.created_at as signup_date,
            ca.first_touch_source,
            ca.first_touch_medium,
            ca.first_touch_campaign,
            ca.first_touch_timestamp,
            ca.last_touch_source,
            ca.last_touch_medium,
            ca.last_touch_campaign,
            ca.last_touch_timestamp,
            ca.lead_status,
            ca.assigned_employee_id,
            emp.name as assigned_employee_name,
            COALESCE(ord_summary.orders_count, 0) as total_orders,
            COALESCE(ord_summary.total_revenue, 0) as total_revenue,
            ord_summary.last_purchase_date
        FROM public.customer_attribution ca
        JOIN public.users u ON u.id = ca.user_id
        LEFT JOIN public.users emp ON emp.id = ca.assigned_employee_id
        LEFT JOIN (
            SELECT user_id, COUNT(*) as orders_count, SUM(order_amount) as total_revenue, MAX(created_at) as last_purchase_date
            FROM public.order_attribution
            GROUP BY user_id
        ) ord_summary ON ord_summary.user_id = u.id
        WHERE (p_campaign_id IS NULL OR ca.first_touch_campaign_id = p_campaign_id OR ca.last_touch_campaign_id = p_campaign_id)
          AND (p_source IS NULL OR LOWER(ca.first_touch_source) = LOWER(p_source) OR LOWER(ca.last_touch_source) = LOWER(p_source))
          AND (p_medium IS NULL OR LOWER(ca.first_touch_medium) = LOWER(p_medium) OR LOWER(ca.last_touch_medium) = LOWER(p_medium))
          AND (p_assigned_employee_id IS NULL OR ca.assigned_employee_id = p_assigned_employee_id)
          AND (p_search IS NULL OR u.name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%' OR u.phone ILIKE '%' || p_search || '%')
        ORDER BY u.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object(
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset,
        'leads', v_leads
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 17. BULK LEAD ASSIGNMENT RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kotson_assign_lead(
    p_customer_ids UUID[],
    p_new_assignee_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_prev_assignee UUID;
    v_count INT := 0;
BEGIN
    IF NOT public.is_admin_or_owner() THEN
        RAISE EXCEPTION 'Access denied. Owner Admin privilege required.';
    END IF;

    FOREACH v_user_id IN ARRAY p_customer_ids LOOP
        SELECT assigned_employee_id INTO v_prev_assignee
        FROM public.customer_attribution
        WHERE user_id = v_user_id;

        UPDATE public.customer_attribution
        SET assigned_employee_id = p_new_assignee_id,
            updated_at = NOW()
        WHERE user_id = v_user_id;

        INSERT INTO public.marketing_lead_assignments (
            user_id, previous_assignee_id, new_assignee_id, assigned_by, notes
        ) VALUES (
            v_user_id, v_prev_assignee, p_new_assignee_id, auth.uid(), p_notes
        );

        v_count := v_count + 1;
    END LOOP;

    -- Audit log entry
    INSERT INTO public.marketing_audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'LEAD_ASSIGNED', 'customer_attribution', p_new_assignee_id::TEXT, jsonb_build_object(
        'assigned_count', v_count,
        'new_assignee_id', p_new_assignee_id,
        'notes', p_notes
    ));

    RETURN jsonb_build_object('success', true, 'assigned_count', v_count);
END;
$$;
