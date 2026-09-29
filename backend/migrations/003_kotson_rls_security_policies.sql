-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 003
-- ROW LEVEL SECURITY (RLS) POLICIES & AUTHORIZATION GUARDS
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
-- Service Role Superuser Bypass (Backend APIs use Service Role Key)
-- -----------------------------------------------------------------------------
CREATE POLICY "service_role_all_users" ON users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_sessions" ON user_sessions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_addresses" ON user_addresses FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_carts" ON carts FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_orders" ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_rewards" ON referral_rewards FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_withdrawals" ON referral_withdrawals FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "service_role_all_kyc" ON kyc_records FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- Customer Self-Access Policies
-- -----------------------------------------------------------------------------
-- Users can only select and update their own user record
CREATE POLICY "users_self_select" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_self_update" ON users FOR UPDATE USING (id = auth.uid());

-- Addresses: Customers can manage only their own addresses
CREATE POLICY "addresses_self_all" ON user_addresses FOR ALL USING (user_id = auth.uid());

-- Orders: Customers can view only their own orders
CREATE POLICY "orders_self_select" ON orders FOR SELECT USING (user_id = auth.uid());

-- Referral Rewards & Wallet: Customers can view only their own earnings
CREATE POLICY "rewards_self_select" ON referral_rewards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallet_self_select" ON wallet_ledger FOR SELECT USING (user_id = auth.uid());

-- Withdrawals: Customers can view and insert their own withdrawal requests
CREATE POLICY "withdrawals_self_select" ON referral_withdrawals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "withdrawals_self_insert" ON referral_withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());

-- KYC: Customers can view and submit their own KYC; cannot view others
CREATE POLICY "kyc_self_select" ON kyc_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "kyc_self_insert" ON kyc_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_self_update" ON kyc_records FOR UPDATE USING (user_id = auth.uid());

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

CREATE POLICY "public_read_categories" ON categories FOR SELECT USING (true);
CREATE POLICY "public_read_products" ON products FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_variants" ON product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "public_read_cms_blocks" ON cms_blocks FOR SELECT USING (true);
CREATE POLICY "public_read_cms_claims" ON cms_claims FOR SELECT USING (true);
CREATE POLICY "public_read_cms_pages" ON cms_pages FOR SELECT USING (is_published = true);
CREATE POLICY "public_read_blogs" ON blogs FOR SELECT USING (status = 'PUBLISHED');
