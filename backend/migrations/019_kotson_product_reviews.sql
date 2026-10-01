-- Migration: 019_kotson_product_reviews.sql
-- Product Reviews, Storage policies, and KYC/Bank columns for Refer & Earn

-- 1. Ensure kyc_info and bank_info columns exist on users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS kyc_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS bank_info JSONB DEFAULT '{}'::jsonb;

-- 2. Create product_reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255),
    product_name VARCHAR(255),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,
    customer_display_name VARCHAR(255) NOT NULL,
    is_verified_purchase BOOLEAN DEFAULT TRUE NOT NULL,
    status VARCHAR(50) DEFAULT 'live' NOT NULL CHECK (status IN ('pending', 'live', 'hidden')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_product_reviews_user_order_item UNIQUE (user_id, order_id, order_item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON public.product_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews (status);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view live reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Admins can view all reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Admins can update any review" ON public.product_reviews;
DROP POLICY IF EXISTS "Admins can delete any review" ON public.product_reviews;

-- 3. RLS Policies
-- Public view live
CREATE POLICY "Public can view live reviews" 
ON public.product_reviews 
FOR SELECT 
USING (status = 'live');

-- Users view own
CREATE POLICY "Users can view their own reviews" 
ON public.product_reviews 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Admins view all
CREATE POLICY "Admins can view all reviews" 
ON public.product_reviews 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.roles && ARRAY['owner', 'admin']::text[]
    )
);

-- 4. Storage Policy for Review Media in kotson-media
DROP POLICY IF EXISTS "Authenticated Customers Upload Review Media" ON storage.objects;
CREATE POLICY "Authenticated Customers Upload Review Media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kotson-media'
    AND (storage.foldername(name))[1] = 'reviews'
);

-- 5. RPC: kotson_submit_product_review
-- Secure server-side validation: never trusts frontend claims.
CREATE OR REPLACE FUNCTION public.kotson_submit_product_review(
    p_user_id UUID,
    p_order_id UUID,
    p_order_item_id VARCHAR,
    p_product_id VARCHAR,
    p_variant_id VARCHAR,
    p_rating INTEGER,
    p_feedback TEXT,
    p_media_urls JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_user RECORD;
    v_item JSONB;
    v_item_found BOOLEAN := FALSE;
    v_display_name VARCHAR;
    v_first_name VARCHAR;
    v_last_initial VARCHAR;
    v_review_id UUID;
    v_existing_id UUID;
    v_prod_name VARCHAR := 'Kotson Product';
BEGIN
    -- Validate rating
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be an integer between 1 and 5';
    END IF;

    -- Validate user
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Compute safe display name (e.g. "Rahul S." or "Verified Customer", never email/phone/user_id)
    IF v_user.name IS NOT NULL AND TRIM(v_user.name) <> '' THEN
        v_first_name := split_part(TRIM(v_user.name), ' ', 1);
        v_last_initial := substring(split_part(TRIM(v_user.name), ' ', 2) from 1 for 1);
        IF v_last_initial IS NOT NULL AND v_last_initial <> '' THEN
            v_display_name := v_first_name || ' ' || UPPER(v_last_initial) || '.';
        ELSE
            v_display_name := v_first_name;
        END IF;
    ELSE
        v_display_name := 'Verified Buyer';
    END IF;

    -- Validate order ownership & genuine delivery
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF v_order.user_id <> p_user_id THEN
        RAISE EXCEPTION 'Access denied: order does not belong to this user';
    END IF;

    -- Payment must be paid
    IF v_order.payment_status <> 'paid' THEN
        RAISE EXCEPTION 'Reviews are permitted only for paid orders';
    END IF;

    -- Must not be cancelled
    IF v_order.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Reviews are not permitted for cancelled orders';
    END IF;

    -- Order must be genuinely delivered
    IF LOWER(COALESCE(v_order.fulfilment_status, '')) NOT IN ('delivered', 'complete', 'completed') THEN
        RAISE EXCEPTION 'Reviews can only be submitted for delivered orders';
    END IF;

    -- Validate that product/item is in the order items
    IF v_order.items IS NOT NULL AND jsonb_array_length(v_order.items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
        LOOP
            IF (v_item->>'product_id' = p_product_id) OR
               (v_item->>'variant_id' = p_variant_id) OR
               (v_item->>'sku' = p_order_item_id) OR
               (v_item->>'variant_id' = p_order_item_id) OR
               (v_item->>'product_slug' = p_product_id) THEN
                v_item_found := TRUE;
                v_prod_name := COALESCE(v_item->>'product_name', v_item->>'title', v_prod_name);
                EXIT;
            END IF;
        END LOOP;
    END IF;

    IF NOT v_item_found THEN
        RAISE EXCEPTION 'Specified product or variant was not purchased in this order';
    END IF;

    -- Check for existing review (Allow customer to edit their existing review)
    SELECT id INTO v_existing_id 
    FROM public.product_reviews 
    WHERE user_id = p_user_id AND order_id = p_order_id AND order_item_id = p_order_item_id;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.product_reviews
        SET rating = p_rating,
            feedback = p_feedback,
            media_urls = COALESCE(p_media_urls, '[]'::jsonb),
            customer_display_name = v_display_name,
            updated_at = NOW()
        WHERE id = v_existing_id
        RETURNING id INTO v_review_id;
    ELSE
        INSERT INTO public.product_reviews (
            user_id,
            order_id,
            order_item_id,
            product_id,
            variant_id,
            product_name,
            rating,
            feedback,
            media_urls,
            customer_display_name,
            is_verified_purchase,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_order_id,
            p_order_item_id,
            p_product_id,
            p_variant_id,
            v_prod_name,
            p_rating,
            p_feedback,
            COALESCE(p_media_urls, '[]'::jsonb),
            v_display_name,
            TRUE,
            'live',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_review_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', v_review_id,
        'rating', p_rating,
        'customer_display_name', v_display_name,
        'is_verified_purchase', true,
        'status', 'live'
    );
END;
$$;

-- 6. RPC: kotson_moderate_review (Owner Admin only)
CREATE OR REPLACE FUNCTION public.kotson_moderate_review(
    p_admin_user_id UUID,
    p_review_id UUID,
    p_action VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin RECORD;
    v_review RECORD;
    v_new_status VARCHAR;
BEGIN
    SELECT * INTO v_admin FROM public.users WHERE id = p_admin_user_id;
    IF NOT FOUND OR NOT (v_admin.roles && ARRAY['owner', 'admin']::text[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can moderate reviews';
    END IF;

    SELECT * INTO v_review FROM public.product_reviews WHERE id = p_review_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review not found';
    END IF;

    IF UPPER(p_action) = 'LIVE' THEN
        v_new_status := 'live';
        UPDATE public.product_reviews 
        SET status = 'live', updated_at = NOW() 
        WHERE id = p_review_id;
    ELSIF UPPER(p_action) = 'HIDE' THEN
        v_new_status := 'hidden';
        UPDATE public.product_reviews 
        SET status = 'hidden', updated_at = NOW() 
        WHERE id = p_review_id;
    ELSIF UPPER(p_action) = 'DELETE' THEN
        DELETE FROM public.product_reviews WHERE id = p_review_id;
        v_new_status := 'deleted';
    ELSE
        RAISE EXCEPTION 'Invalid action: % (expected LIVE, HIDE, or DELETE)', p_action;
    END IF;

    -- Record in audit_logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        p_admin_user_id,
        'review.' || LOWER(p_action),
        'product_review',
        p_review_id::text,
        jsonb_build_object(
            'review_id', p_review_id,
            'action', p_action,
            'product_id', v_review.product_id,
            'rating', v_review.rating,
            'customer_display_name', v_review.customer_display_name,
            'moderated_by', v_admin.email
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'review_id', p_review_id,
        'status', v_new_status
    );
END;
$$;
