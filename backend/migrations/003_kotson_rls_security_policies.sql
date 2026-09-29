-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 003
-- ROW LEVEL SECURITY (RLS) POLICIES & AUTHORIZATION GUARDS
-- =============================================================================
-- Architecture & Trust Boundary Documentation:
-- 1. All application traffic routes through the Kotson FastAPI backend.
-- 2. Direct browser connections never touch Supabase PostgREST tables.
-- 3. Customer authentication and RBAC are authoritatively enforced by FastAPI.
-- 4. Database RLS serves as defense-in-depth: anonymous public access to sensitive
--    tables is blocked; only public catalog tables allow storefront SELECT.
-- =============================================================================

-- Enable Row Level Security on Sensitive Tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Service Role Superuser Bypass (Backend APIs use Service Role Key or DB owner)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_role_all_users" ON users;
CREATE POLICY "service_role_all_users" ON users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_sessions" ON user_sessions;
CREATE POLICY "service_role_all_sessions" ON user_sessions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_addresses" ON user_addresses;
CREATE POLICY "service_role_all_addresses" ON user_addresses FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_carts" ON carts;
CREATE POLICY "service_role_all_carts" ON carts FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
CREATE POLICY "service_role_all_orders" ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_rewards" ON referral_rewards;
CREATE POLICY "service_role_all_rewards" ON referral_rewards FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_withdrawals" ON referral_withdrawals;
CREATE POLICY "service_role_all_withdrawals" ON referral_withdrawals FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "service_role_all_kyc" ON kyc_records;
CREATE POLICY "service_role_all_kyc" ON kyc_records FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- Public Read Access for Storefront Catalog & CMS
-- -----------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "public_read_variants" ON product_variants;
CREATE POLICY "public_read_variants" ON product_variants FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "public_read_cms_blocks" ON cms_blocks;
CREATE POLICY "public_read_cms_blocks" ON cms_blocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_cms_claims" ON cms_claims;
CREATE POLICY "public_read_cms_claims" ON cms_claims FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_cms_pages" ON cms_pages;
CREATE POLICY "public_read_cms_pages" ON cms_pages FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "public_read_blogs" ON blogs;
CREATE POLICY "public_read_blogs" ON blogs FOR SELECT USING (status = 'PUBLISHED');
