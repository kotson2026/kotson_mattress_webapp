-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 015
-- CMS, BLOGS, SUPABASE STORAGE, CUSTOM DIMENSION CONFIG & PG_CRON RESERVATION EXPIRY
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. SUPABASE STORAGE (kotson-media bucket)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'kotson-media',
    'kotson-media',
    true,
    52428800, -- 50 MB
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif',
        'video/mp4', 'video/webm',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif',
        'video/mp4', 'video/webm',
        'application/pdf'
    ];

-- Storage objects public read policy
DROP POLICY IF EXISTS "Public Read kotson-media" ON storage.objects;
CREATE POLICY "Public Read kotson-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'kotson-media');

-- -----------------------------------------------------------------------------
-- 2. ASSETS REGISTRY & SAFETY CHECKS
-- -----------------------------------------------------------------------------
ALTER TABLE public.assets
    ADD COLUMN IF NOT EXISTS title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other',
    ADD COLUMN IF NOT EXISTS file_size_kb NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
    ALTER COLUMN slot DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_slot ON public.assets(slot);

-- Asset Registration RPC (Server-side validation)
CREATE OR REPLACE FUNCTION public.kotson_register_asset(
    p_asset JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_asset_id UUID;
    v_url TEXT;
    v_title VARCHAR(255);
    v_mime VARCHAR(100);
    v_size_kb NUMERIC(10, 2);
    v_cat VARCHAR(50);
    v_slot VARCHAR(100);
    v_alt TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can register media assets';
    END IF;

    v_url := TRIM(p_asset->>'url');
    IF v_url IS NULL OR v_url = '' THEN
        RAISE EXCEPTION 'Asset URL is required';
    END IF;

    -- Path traversal protection
    IF v_url ~ '\.\./' THEN
        RAISE EXCEPTION 'Unsafe file path: path traversal detected';
    END IF;

    v_mime := LOWER(TRIM(COALESCE(p_asset->>'mime_type', 'image/jpeg')));
    IF v_mime NOT IN (
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/avif',
        'video/mp4', 'video/webm', 'application/pdf'
    ) THEN
        RAISE EXCEPTION 'Unsafe or unsupported MIME type: %', v_mime;
    END IF;

    v_title := COALESCE(p_asset->>'title', 'Asset');
    v_size_kb := COALESCE((p_asset->>'file_size_kb')::NUMERIC, 0);
    IF v_size_kb > 51200 THEN -- 50 MB
        RAISE EXCEPTION 'File size exceeds maximum allowed limit (50 MB)';
    END IF;

    v_cat := COALESCE(p_asset->>'category', 'Other');
    v_slot := COALESCE(p_asset->>'slot', 'general');
    v_alt := p_asset->>'alt';
    v_asset_id := gen_random_uuid();

    INSERT INTO public.assets (
        id, slot, url, alt, width, height, mime_type, title, category, file_size_kb, created_by, metadata, created_at
    ) VALUES (
        v_asset_id, v_slot, v_url, v_alt,
        (p_asset->>'width')::INT, (p_asset->>'height')::INT,
        v_mime, v_title, v_cat, v_size_kb, p_actor_id,
        COALESCE(p_asset->'metadata', '{}'::JSONB), NOW()
    );

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'asset.registered', 'asset', v_asset_id::TEXT,
            jsonb_build_object('url', v_url, 'title', v_title, 'mime', v_mime));

    RETURN jsonb_build_object('success', true, 'asset_id', v_asset_id, 'url', v_url);
END;
$$;

-- Safe Asset Deletion (Prevents breaking live referenced content)
CREATE OR REPLACE FUNCTION public.kotson_delete_asset(
    p_asset_id UUID,
    p_force BOOLEAN,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_asset RECORD;
    v_product_refs INT := 0;
    v_cms_refs INT := 0;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can delete media assets';
    END IF;

    SELECT * INTO v_asset FROM public.assets WHERE id = p_asset_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found';
    END IF;

    -- Check if used in Products
    SELECT COUNT(*) INTO v_product_refs
    FROM public.products
    WHERE image_url = v_asset.url;

    -- Check if used in CMS published sections
    SELECT COUNT(*) INTO v_cms_refs
    FROM public.cms_pages
    WHERE published_sections::TEXT LIKE '%' || v_asset.url || '%';

    IF (v_product_refs > 0 OR v_cms_refs > 0) AND NOT p_force THEN
        RAISE EXCEPTION 'Cannot delete asset: actively referenced in % product(s) and % CMS page(s). Use force=true or archive.',
            v_product_refs, v_cms_refs;
    END IF;

    DELETE FROM public.assets WHERE id = p_asset_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'asset.deleted', 'asset', p_asset_id::TEXT,
            jsonb_build_object('url', v_asset.url, 'force', p_force));

    RETURN jsonb_build_object('success', true, 'message', 'Asset deleted successfully');
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. WEBSITE CMS SCHEMA & HOMEPAGE SECTIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.cms_pages
    ADD COLUMN IF NOT EXISTS published_sections JSONB DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS has_draft_changes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS seo_description TEXT,
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_by VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_pages_slug ON public.cms_pages(slug);

-- Public Storefront: reads published version only
CREATE OR REPLACE FUNCTION public.kotson_get_public_homepage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_page RECORD;
    v_sections JSONB := '[]'::JSONB;
    v_sec JSONB;
BEGIN
    SELECT * INTO v_page FROM public.cms_pages WHERE slug = 'home';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Homepage not found');
    END IF;

    -- Published storefront reads only published_sections where is_visible is true
    FOR v_sec IN SELECT * FROM jsonb_array_elements(COALESCE(v_page.published_sections, '[]'::JSONB))
    LOOP
        IF COALESCE((v_sec->>'is_visible')::BOOLEAN, true) THEN
            v_sections := v_sections || jsonb_build_array(v_sec);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'slug', 'home',
        'title', v_page.title,
        'seo_title', v_page.seo_title,
        'seo_description', v_page.seo_description,
        'sections', v_sections,
        'published_at', v_page.published_at
    );
END;
$$;

-- Update CMS Draft (Owner / Admin only; with XSS sanitization)
CREATE OR REPLACE FUNCTION public.kotson_update_cms_draft(
    p_slug VARCHAR,
    p_sections JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_page RECORD;
    v_sec_str TEXT;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can edit website CMS';
    END IF;

    SELECT * INTO v_page FROM public.cms_pages WHERE slug = p_slug;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Page not found with slug: %', p_slug;
    END IF;

    -- Security check: Script and executable injection rejection
    v_sec_str := p_sections::TEXT;
    IF v_sec_str ~* '(<script|javascript:|onload\s*=|onerror\s*=|onclick\s*=|eval\()' THEN
        RAISE EXCEPTION 'Script injection or unsafe executable code detected in CMS content';
    END IF;

    UPDATE public.cms_pages
    SET sections = p_sections,
        has_draft_changes = TRUE,
        updated_at = NOW(),
        updated_by = v_actor.email
    WHERE slug = p_slug;

    RETURN jsonb_build_object('success', true, 'slug', p_slug, 'has_draft_changes', true);
END;
$$;

-- Publish CMS Page (Owner / Admin only; transaction-safe)
CREATE OR REPLACE FUNCTION public.kotson_publish_cms_page(
    p_slug VARCHAR,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_page RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can publish CMS pages';
    END IF;

    SELECT * INTO v_page FROM public.cms_pages WHERE slug = p_slug FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Page not found with slug: %', p_slug;
    END IF;

    UPDATE public.cms_pages
    SET published_sections = sections,
        status = 'published',
        is_published = TRUE,
        has_draft_changes = FALSE,
        published_at = NOW(),
        published_by = v_actor.email,
        updated_at = NOW()
    WHERE slug = p_slug;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'cms.page.published', 'cms_page', v_page.id::TEXT,
            jsonb_build_object('slug', p_slug, 'published_by', v_actor.email));

    RETURN jsonb_build_object(
        'success', true,
        'slug', p_slug,
        'status', 'published',
        'published_at', NOW()
    );
END;
$$;

-- Discard CMS Draft
CREATE OR REPLACE FUNCTION public.kotson_discard_cms_draft(
    p_slug VARCHAR,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_page RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can discard drafts';
    END IF;

    SELECT * INTO v_page FROM public.cms_pages WHERE slug = p_slug FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Page not found with slug: %', p_slug;
    END IF;

    UPDATE public.cms_pages
    SET sections = published_sections,
        has_draft_changes = FALSE,
        updated_at = NOW()
    WHERE slug = p_slug;

    RETURN jsonb_build_object('success', true, 'slug', p_slug, 'message', 'Draft discarded');
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. BLOGS SYSTEM
-- -----------------------------------------------------------------------------
ALTER TABLE public.blogs
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS seo_description TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blogs_slug ON public.blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_pub_status ON public.blogs(status, published_at DESC);

-- Public Blog List (Reads published blogs only, supports pagination)
CREATE OR REPLACE FUNCTION public.kotson_get_public_blogs(
    p_limit INT DEFAULT 12,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total INT;
    v_items JSONB := '[]'::JSONB;
    v_row RECORD;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.blogs
    WHERE status = 'published' AND published_at <= NOW();

    FOR v_row IN
        SELECT id, slug, title, excerpt, author_name, featured_image,
               published_at, created_at, seo_title, seo_description
        FROM public.blogs
        WHERE status = 'published' AND published_at <= NOW()
        ORDER BY published_at DESC
        LIMIT GREATEST(1, LEAST(p_limit, 50))
        OFFSET GREATEST(0, p_offset)
    LOOP
        v_items := v_items || to_jsonb(v_row);
    END LOOP;

    RETURN jsonb_build_object(
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset,
        'items', v_items
    );
END;
$$;

-- Public Blog by Slug (Strict published filter)
CREATE OR REPLACE FUNCTION public.kotson_get_public_blog_by_slug(p_slug VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_blog RECORD;
BEGIN
    SELECT id, slug, title, excerpt, content, author_name, featured_image,
           published_at, created_at, seo_title, seo_description
    INTO v_blog
    FROM public.blogs
    WHERE slug = p_slug AND status = 'published' AND published_at <= NOW();

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(v_blog);
END;
$$;

-- Save Blog (Create or Update; Owner/Admin only; Unique slug enforcement)
CREATE OR REPLACE FUNCTION public.kotson_save_blog(
    p_blog JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_id VARCHAR(100);
    v_slug VARCHAR(255);
    v_title VARCHAR(255);
    v_existing RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can manage blogs';
    END IF;

    v_title := TRIM(p_blog->>'title');
    IF v_title IS NULL OR v_title = '' THEN
        RAISE EXCEPTION 'Blog title is required';
    END IF;

    v_slug := LOWER(TRIM(p_blog->>'slug'));
    IF v_slug IS NULL OR v_slug = '' THEN
        v_slug := REGEXP_REPLACE(LOWER(v_title), '[^a-z0-9]+', '-', 'g');
    END IF;

    v_id := COALESCE(p_blog->>'id', 'blog_' || gen_random_uuid()::TEXT);

    -- Check unique slug
    SELECT * INTO v_existing FROM public.blogs WHERE slug = v_slug AND id != v_id;
    IF FOUND THEN
        RAISE EXCEPTION 'A blog with slug % already exists', v_slug;
    END IF;

    INSERT INTO public.blogs (
        id, slug, title, excerpt, content, author_name, featured_image,
        status, published_at, created_at, updated_at, updated_by, seo_title, seo_description
    ) VALUES (
        v_id, v_slug, v_title,
        p_blog->>'excerpt', p_blog->>'content',
        COALESCE(p_blog->>'author_name', 'Kotson Team'),
        p_blog->>'featured_image',
        COALESCE(p_blog->>'status', 'draft'),
        CASE WHEN p_blog->>'status' = 'published' THEN COALESCE((p_blog->>'published_at')::TIMESTAMPTZ, NOW()) ELSE NULL END,
        NOW(), NOW(), v_actor.email,
        COALESCE(p_blog->>'seo_title', v_title),
        p_blog->>'seo_description'
    )
    ON CONFLICT (id) DO UPDATE SET
        slug = v_slug,
        title = v_title,
        excerpt = EXCLUDED.excerpt,
        content = EXCLUDED.content,
        author_name = EXCLUDED.author_name,
        featured_image = EXCLUDED.featured_image,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        updated_at = NOW(),
        updated_by = v_actor.email;

    RETURN jsonb_build_object('success', true, 'id', v_id, 'slug', v_slug);
END;
$$;

-- Publish Blog
CREATE OR REPLACE FUNCTION public.kotson_publish_blog(
    p_blog_id VARCHAR,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_blog RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can publish blogs';
    END IF;

    SELECT * INTO v_blog FROM public.blogs WHERE id = p_blog_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Blog not found';
    END IF;

    UPDATE public.blogs
    SET status = 'published',
        published_at = NOW(),
        updated_at = NOW(),
        updated_by = v_actor.email
    WHERE id = p_blog_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'blog.published', 'blog', p_blog_id,
            jsonb_build_object('title', v_blog.title, 'slug', v_blog.slug));

    RETURN jsonb_build_object('success', true, 'status', 'published', 'published_at', NOW());
END;
$$;

-- Unpublish Blog
CREATE OR REPLACE FUNCTION public.kotson_unpublish_blog(
    p_blog_id VARCHAR,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
    v_blog RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can unpublish blogs';
    END IF;

    SELECT * INTO v_blog FROM public.blogs WHERE id = p_blog_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Blog not found';
    END IF;

    UPDATE public.blogs
    SET status = 'draft',
        updated_at = NOW(),
        updated_by = v_actor.email
    WHERE id = p_blog_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'blog.unpublished', 'blog', p_blog_id,
            jsonb_build_object('title', v_blog.title, 'slug', v_blog.slug));

    RETURN jsonb_build_object('success', true, 'status', 'draft');
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. CUSTOM PRODUCT DIMENSION CONFIGURATION & VALIDATION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_product_dimension_config (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    unit VARCHAR(20) NOT NULL DEFAULT 'inches',
    min_length NUMERIC(6, 2) NOT NULL DEFAULT 30.0,
    max_length NUMERIC(6, 2) NOT NULL DEFAULT 96.0,
    length_step NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
    min_width NUMERIC(6, 2) NOT NULL DEFAULT 24.0,
    max_width NUMERIC(6, 2) NOT NULL DEFAULT 84.0,
    width_step NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
    min_thickness NUMERIC(6, 2) NOT NULL DEFAULT 4.0,
    max_thickness NUMERIC(6, 2) NOT NULL DEFAULT 12.0,
    thickness_step NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
    enabled_dimensions TEXT[] NOT NULL DEFAULT ARRAY['length', 'width', 'thickness'],
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.custom_product_requests
    ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'inches',
    ADD COLUMN IF NOT EXISTS quote_status VARCHAR(50) DEFAULT 'PENDING_QUOTE';

-- Seed default configuration if empty
INSERT INTO public.custom_product_dimension_config (
    id, unit, min_length, max_length, length_step,
    min_width, max_width, width_step,
    min_thickness, max_thickness, thickness_step,
    enabled_dimensions
) VALUES (
    'default', 'inches', 30.0, 96.0, 1.0,
    24.0, 84.0, 1.0,
    4.0, 12.0, 1.0,
    ARRAY['length', 'width', 'thickness']
)
ON CONFLICT (id) DO NOTHING;

-- Update Custom Product Dimension Configuration (Owner/Admin only)
CREATE OR REPLACE FUNCTION public.kotson_update_custom_dimension_config(
    p_config JSONB,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor RECORD;
BEGIN
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
    IF NOT FOUND OR NOT (v_actor.roles && ARRAY['owner', 'admin']::TEXT[]) THEN
        RAISE EXCEPTION 'Access denied: only owner or admin can configure custom dimension rules';
    END IF;

    UPDATE public.custom_product_dimension_config
    SET unit = COALESCE(p_config->>'unit', unit),
        min_length = COALESCE((p_config->>'min_length')::NUMERIC, min_length),
        max_length = COALESCE((p_config->>'max_length')::NUMERIC, max_length),
        length_step = COALESCE((p_config->>'length_step')::NUMERIC, length_step),
        min_width = COALESCE((p_config->>'min_width')::NUMERIC, min_width),
        max_width = COALESCE((p_config->>'max_width')::NUMERIC, max_width),
        width_step = COALESCE((p_config->>'width_step')::NUMERIC, width_step),
        min_thickness = COALESCE((p_config->>'min_thickness')::NUMERIC, min_thickness),
        max_thickness = COALESCE((p_config->>'max_thickness')::NUMERIC, max_thickness),
        thickness_step = COALESCE((p_config->>'thickness_step')::NUMERIC, thickness_step),
        updated_at = NOW(),
        updated_by = p_actor_id
    WHERE id = 'default';

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (p_actor_id, 'custom_dimension_rules.updated', 'config', 'default', p_config);

    RETURN jsonb_build_object('success', true, 'message', 'Custom dimension configuration updated');
END;
$$;

-- Refactor kotson_create_custom_request to dynamically use authoritative config
CREATE OR REPLACE FUNCTION public.kotson_create_custom_request(
    p_customer_name VARCHAR,
    p_mobile VARCHAR,
    p_email VARCHAR,
    p_city VARCHAR,
    p_pincode VARCHAR,
    p_product_id VARCHAR,
    p_product_name VARCHAR,
    p_length NUMERIC,
    p_breadth NUMERIC,
    p_thickness NUMERIC,
    p_customer_id UUID DEFAULT NULL,
    p_customer_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cfg RECORD;
    v_req_num VARCHAR;
    v_req_id VARCHAR(100);
BEGIN
    SELECT * INTO v_cfg FROM public.custom_product_dimension_config WHERE id = 'default';
    IF NOT FOUND THEN
        -- Fallback safety defaults
        v_cfg.min_length := 30.0; v_cfg.max_length := 96.0; v_cfg.length_step := 1.0;
        v_cfg.min_width := 24.0; v_cfg.max_width := 84.0; v_cfg.width_step := 1.0;
        v_cfg.min_thickness := 4.0; v_cfg.max_thickness := 12.0; v_cfg.thickness_step := 1.0;
        v_cfg.unit := 'inches';
    END IF;

    -- Dynamic validation against authoritative database configuration
    IF p_length < v_cfg.min_length THEN
        RAISE EXCEPTION 'Invalid dimensions: length below minimum of % %', v_cfg.min_length, v_cfg.unit;
    END IF;

    IF p_length > v_cfg.max_length THEN
        RAISE EXCEPTION 'Invalid dimensions: length above maximum of % %', v_cfg.max_length, v_cfg.unit;
    END IF;

    IF MOD((p_length - v_cfg.min_length)::NUMERIC, v_cfg.length_step::NUMERIC) != 0 THEN
        RAISE EXCEPTION 'Invalid dimensions: length step must be a multiple of % %', v_cfg.length_step, v_cfg.unit;
    END IF;

    IF p_breadth < v_cfg.min_width THEN
        RAISE EXCEPTION 'Invalid dimensions: width below minimum of % %', v_cfg.min_width, v_cfg.unit;
    END IF;

    IF p_breadth > v_cfg.max_width THEN
        RAISE EXCEPTION 'Invalid dimensions: width above maximum of % %', v_cfg.max_width, v_cfg.unit;
    END IF;

    IF MOD((p_breadth - v_cfg.min_width)::NUMERIC, v_cfg.width_step::NUMERIC) != 0 THEN
        RAISE EXCEPTION 'Invalid dimensions: width step must be a multiple of % %', v_cfg.width_step, v_cfg.unit;
    END IF;

    IF p_thickness < v_cfg.min_thickness THEN
        RAISE EXCEPTION 'Invalid dimensions: thickness below minimum of % %', v_cfg.min_thickness, v_cfg.unit;
    END IF;

    IF p_thickness > v_cfg.max_thickness THEN
        RAISE EXCEPTION 'Invalid dimensions: thickness above maximum of % %', v_cfg.max_thickness, v_cfg.unit;
    END IF;

    IF MOD((p_thickness - v_cfg.min_thickness)::NUMERIC, v_cfg.thickness_step::NUMERIC) != 0 THEN
        RAISE EXCEPTION 'Invalid dimensions: thickness step must be a multiple of % %', v_cfg.thickness_step, v_cfg.unit;
    END IF;

    IF p_customer_name IS NULL OR TRIM(p_customer_name) = '' OR p_mobile IS NULL OR TRIM(p_mobile) = '' THEN
        RAISE EXCEPTION 'Customer name and mobile number are required';
    END IF;

    v_req_num := public.kotson_generate_custom_request_number();
    v_req_id := 'cr_' || gen_random_uuid()::TEXT;

    INSERT INTO public.custom_product_requests (
        id, request_number, customer_id, customer_name, mobile, email, city, pincode,
        product_id, product_name_snapshot, length, breadth, height_or_thickness,
        unit, customer_remarks, status, quoted_price, quote_status, created_at, updated_at
    ) VALUES (
        v_req_id, v_req_num, p_customer_id, p_customer_name, p_mobile, p_email, p_city, p_pincode,
        p_product_id, p_product_name, p_length::TEXT, p_breadth::TEXT, p_thickness::TEXT,
        v_cfg.unit, p_customer_remarks, 'NEW', NULL, 'PENDING_QUOTE', NOW(), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_req_id,
        'request_number', v_req_num,
        'status', 'NEW'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. PG_CRON SCHEDULED RESERVATION EXPIRY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cron_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,
    details JSONB
);

CREATE OR REPLACE FUNCTION public.kotson_run_scheduled_reservation_release()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_res JSONB;
BEGIN
    v_res := public.kotson_release_expired_reservations();
    
    -- Only log execution if reservations were released to prevent log bloat
    IF (v_res->>'released_count')::INT > 0 THEN
        INSERT INTO public.cron_execution_logs (job_name, status, details)
        VALUES ('release_expired_reservations', 'SUCCESS', v_res);
    END IF;

    RETURN v_res;
END;
$$;

-- Schedule job via pg_cron (Every 1 minute)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('kotson-release-expired-reservations')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kotson-release-expired-reservations');

        PERFORM cron.schedule(
            'kotson-release-expired-reservations',
            '* * * * *',
            'SELECT public.kotson_run_scheduled_reservation_release();'
        );
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. SEED INITIAL HOMEPAGE CMS WITH APPROVED 11 SECTIONS
-- -----------------------------------------------------------------------------
INSERT INTO public.cms_pages (
    id, slug, title, seo_title, seo_description, status, is_published,
    sections, published_sections, published_at, updated_at
) VALUES (
    gen_random_uuid(),
    'home',
    'Homepage',
    'Kotson Mattress — 100% Organic Dunlop Latex Mattresses Made in India',
    'GOLS-certified organic Dunlop latex mattresses with 7-zone anatomical support, 30-night trial, and 10-year warranty.',
    'published',
    true,
    '[
        {"id": "sec-hero-video-live", "type": "hero_video", "title": "Hero Video / Banner", "order": 0, "is_visible": true, "config": {"video_url": "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4", "poster_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png", "cta_label": "Shop Mattresses", "cta_link": "/collections/mattresses"}},
        {"id": "sec-sleep-ribbon-live", "type": "announcement_bar", "title": "Announcement Ribbon", "order": 1, "is_visible": true, "config": {"messages": ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"], "separator": "✦", "speed": 40}},
        {"id": "sec-explore-categories-live", "type": "category_grid", "title": "Explore Our Categories", "order": 2, "is_visible": true, "config": {"heading": "Explore Our Categories", "categories": [{"slug": "mattresses", "name": "Mattresses"}, {"slug": "pillows", "name": "Pillows"}, {"slug": "toppers", "name": "Toppers"}, {"slug": "baby-kids", "name": "Baby + Kids"}]}},
        {"id": "sec-shark-tank-live", "type": "shark_tank_feature", "title": "Shark Tank India Feature", "order": 3, "is_visible": true, "config": {"youtube_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo", "eyebrow": "AS SEEN ON", "caption": "KOTSON × SHARK TANK INDIA"}},
        {"id": "sec-whats-inside-live", "type": "mattress_layer_breakdown", "title": "What''s Inside Kotson?", "order": 4, "is_visible": true, "config": {"heading": "What''s Inside The Mattress?", "layers": [{"name": "100% PURE BAMBOO COVER"}, {"name": "THIN COTTON ZIP COVER"}, {"name": "GOLS-CERTIFIED 100% ORGANIC LATEX CORE"}]}},
        {"id": "sec-seven-zones-live", "type": "seven_zones_support", "title": "7-Zone Support", "order": 5, "is_visible": true, "config": {"heading": "Support, Where Your Body Needs It.", "benefits": [{"label": "Temperature Balance"}, {"label": "Motion Isolation"}, {"label": "Organic 100%"}]}},
        {"id": "sec-organic-process-live", "type": "organic_latex_process", "title": "Organic Latex Process", "order": 6, "is_visible": true, "config": {"heading": "How an Organic Latex Mattress Is Made"}},
        {"id": "sec-certifications-live", "type": "certifications_badges", "title": "Certifications & Trust Explorer", "order": 7, "is_visible": true, "config": {"heading": "Proof in Every Layer.", "cert_keys": ["gols", "eco-institut", "fsc", "lga", "oeko-tex"]}},
        {"id": "sec-testimonials-live", "type": "customer_testimonials", "title": "Customer Testimonials", "order": 8, "is_visible": true, "config": {"heading": "Customer Testimonials"}},
        {"id": "sec-explore-stores-live", "type": "explore_stores", "title": "Explore Our Stores", "order": 9, "is_visible": true, "config": {"heading": "Explore Our Stores"}},
        {"id": "sec-need-help-live", "type": "need_help_choosing", "title": "Need Help Choosing?", "order": 10, "is_visible": true, "config": {"heading": "NEED HELP CHOOSING?"}}
    ]'::JSONB,
    '[
        {"id": "sec-hero-video-live", "type": "hero_video", "title": "Hero Video / Banner", "order": 0, "is_visible": true, "config": {"video_url": "https://videotourl.com/videos/1790000883825-6f099fbc-0ae3-4af8-8859-7bb8331633ba.mp4", "poster_url": "https://cdn.phototourl.com/member/2026-09-21-becf1398-8387-4f2c-a4bd-729072937fdf.png", "cta_label": "Shop Mattresses", "cta_link": "/collections/mattresses"}},
        {"id": "sec-sleep-ribbon-live", "type": "announcement_bar", "title": "Announcement Ribbon", "order": 1, "is_visible": true, "config": {"messages": ["100% ORGANIC", "FREE SHIPPING", "CHEMICAL FREE"], "separator": "✦", "speed": 40}},
        {"id": "sec-explore-categories-live", "type": "category_grid", "title": "Explore Our Categories", "order": 2, "is_visible": true, "config": {"heading": "Explore Our Categories", "categories": [{"slug": "mattresses", "name": "Mattresses"}, {"slug": "pillows", "name": "Pillows"}, {"slug": "toppers", "name": "Toppers"}, {"slug": "baby-kids", "name": "Baby + Kids"}]}},
        {"id": "sec-shark-tank-live", "type": "shark_tank_feature", "title": "Shark Tank India Feature", "order": 3, "is_visible": true, "config": {"youtube_url": "https://www.youtube.com/watch?v=xF_ri6AQJMo", "eyebrow": "AS SEEN ON", "caption": "KOTSON × SHARK TANK INDIA"}},
        {"id": "sec-whats-inside-live", "type": "mattress_layer_breakdown", "title": "What''s Inside Kotson?", "order": 4, "is_visible": true, "config": {"heading": "What''s Inside The Mattress?", "layers": [{"name": "100% PURE BAMBOO COVER"}, {"name": "THIN COTTON ZIP COVER"}, {"name": "GOLS-CERTIFIED 100% ORGANIC LATEX CORE"}]}},
        {"id": "sec-seven-zones-live", "type": "seven_zones_support", "title": "7-Zone Support", "order": 5, "is_visible": true, "config": {"heading": "Support, Where Your Body Needs It.", "benefits": [{"label": "Temperature Balance"}, {"label": "Motion Isolation"}, {"label": "Organic 100%"}]}},
        {"id": "sec-organic-process-live", "type": "organic_latex_process", "title": "Organic Latex Process", "order": 6, "is_visible": true, "config": {"heading": "How an Organic Latex Mattress Is Made"}},
        {"id": "sec-certifications-live", "type": "certifications_badges", "title": "Certifications & Trust Explorer", "order": 7, "is_visible": true, "config": {"heading": "Proof in Every Layer.", "cert_keys": ["gols", "eco-institut", "fsc", "lga", "oeko-tex"]}},
        {"id": "sec-testimonials-live", "type": "customer_testimonials", "title": "Customer Testimonials", "order": 8, "is_visible": true, "config": {"heading": "Customer Testimonials"}},
        {"id": "sec-explore-stores-live", "type": "explore_stores", "title": "Explore Our Stores", "order": 9, "is_visible": true, "config": {"heading": "Explore Our Stores"}},
        {"id": "sec-need-help-live", "type": "need_help_choosing", "title": "Need Help Choosing?", "order": 10, "is_visible": true, "config": {"heading": "NEED HELP CHOOSING?"}}
    ]'::JSONB,
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    published_sections = EXCLUDED.published_sections,
    is_published = true,
    status = 'published';

