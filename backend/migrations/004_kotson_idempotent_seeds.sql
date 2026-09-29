-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 004
-- IDEMPOTENT INITIAL SEEDS (NON-DESTRUCTIVE: PRESERVES ALL REGISTERED USERS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CATEGORIES (Idempotent: ON CONFLICT DO NOTHING)
-- -----------------------------------------------------------------------------
INSERT INTO categories (slug, name, description, icon, sort_order)
VALUES
    ('mattresses', 'Mattresses', 'GOLS-certified organic latex mattresses with 7-zone anatomical support.', 'category-mattress', 1),
    ('pillows', 'Pillows', 'Contoured organic latex pillows for every sleep style.', 'category-pillow', 2),
    ('toppers', 'Toppers', 'Refresh any bed with a natural latex comfort layer.', 'category-topper', 3),
    ('baby-kids', 'Baby + Kids', 'Hypoallergenic, VOC-free natural latex for little sleepers.', 'category-babykids', 4)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. CORE REFERRAL RULE (Idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO referral_rules (id, name, commission_type, commission_value, customer_discount_type, customer_discount_value, is_active)
VALUES
    ('default_rule', 'Standard Refer & Earn Rule', 'PERCENTAGE', 5.0, 'PERCENTAGE', 5.0, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. STAGING TEST STAFF ACCOUNTS (Idempotent: ON CONFLICT (email) DO NOTHING)
-- Note: Real customer accounts are NEVER overwritten or dropped!
-- -----------------------------------------------------------------------------
INSERT INTO users (email, phone, name, password_hash, roles, referral_code, is_active)
VALUES
    (
        'hello@kotsonmattress.com',
        '+919800000001',
        'Kotson Owner Admin',
        '$2b$12$K8dYwF89h3tO5zL8Z7WzIeQfA6.7dG.e8.G7H6F5E4D3C2B1A0.', -- hashed
        ARRAY['owner', 'admin']::TEXT[],
        'KS982F2B',
        true
    ),
    (
        'manager@kotsonmattress.com',
        '+919800000002',
        'Operations Manager',
        '$2b$12$K8dYwF89h3tO5zL8Z7WzIeQfA6.7dG.e8.G7H6F5E4D3C2B1A0.',
        ARRAY['manager']::TEXT[],
        'KS1A9BD9',
        true
    ),
    (
        'crm@kotsonmattress.com',
        '+919800000003',
        'CRM Master Admin',
        '$2b$12$K8dYwF89h3tO5zL8Z7WzIeQfA6.7dG.e8.G7H6F5E4D3C2B1A0.',
        ARRAY['crm_master']::TEXT[],
        'KSBCBF1C',
        true
    ),
    (
        'crm.employee@kotsonmattress.com',
        '+919800000004',
        'CRM Sleep Specialist',
        '$2b$12$K8dYwF89h3tO5zL8Z7WzIeQfA6.7dG.e8.G7H6F5E4D3C2B1A0.',
        ARRAY['crm_employee']::TEXT[],
        'KS015125',
        true
    ),
    (
        'stock@kotsonmattress.com',
        '+919800000005',
        'Stock Point Manager',
        '$2b$12$K8dYwF89h3tO5zL8Z7WzIeQfA6.7dG.e8.G7H6F5E4D3C2B1A0.',
        ARRAY['stock_point_manager']::TEXT[],
        'KSED8D15',
        true
    )
ON CONFLICT (email) DO NOTHING;
