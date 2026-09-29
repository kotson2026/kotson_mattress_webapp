-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 004
-- IDEMPOTENT INITIAL SEEDS (CATEGORIES & REFERRAL ENGINE RULES)
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
-- 2. CORE REFERRAL RULE (Idempotent: ON CONFLICT DO NOTHING)
-- -----------------------------------------------------------------------------
INSERT INTO referral_rules (id, name, commission_type, commission_value, customer_discount_type, customer_discount_value, is_active)
VALUES
    ('default_rule', 'Standard Refer & Earn Rule', 'PERCENTAGE', 5.0, 'PERCENTAGE', 5.0, true)
ON CONFLICT (id) DO NOTHING;

-- Note: Staff accounts with default/test passwords have been removed from
-- automated SQL seed to ensure production databases are never seeded with
-- publicly known static credentials. Staff accounts are initialized via
-- secure environment variables (SEED_OWNER_PASSWORD).
