-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 002
-- REFERRAL ENGINE, KYC, WALLETS, CRM, CMS, AUDIT LOGS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REFERRAL RULES & CONFIGURATION
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_rules (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('FLAT', 'PERCENTAGE')),
    commission_value NUMERIC(10, 2) NOT NULL CHECK (commission_value >= 0),
    customer_discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE' CHECK (customer_discount_type IN ('FLAT', 'PERCENTAGE')),
    customer_discount_value NUMERIC(10, 2) NOT NULL DEFAULT 5.0 CHECK (customer_discount_value >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. REFERRAL ATTRIBUTIONS & CLICKS (Zero duplicate leads)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL,
    path TEXT,
    ip_hash VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_clicks_code ON referral_clicks(code, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    guest_cart_token VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ATTRIBUTED',
    events JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_attrib_code ON referral_attributions(code);
CREATE INDEX IF NOT EXISTS idx_ref_attrib_guest ON referral_attributions(guest_cart_token);

-- -----------------------------------------------------------------------------
-- 3. REFERRAL REWARDS, COMMISSIONS & WALLET LEDGER
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL,
    order_number VARCHAR(100),
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    rate_applied NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'AVAILABLE_FOR_WITHDRAWAL', 'WITHDRAWAL_REQUESTED', 'ON_HOLD', 'PROCESSING', 'PAID', 'REJECTED', 'REVERSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reward_order_code UNIQUE (order_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ref_rewards_user ON referral_rewards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ref_rewards_status ON referral_rewards(status);

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    balance_paise BIGINT NOT NULL CHECK (balance_paise >= 0),
    description TEXT NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. KYC & WITHDRAWALS (Sensitive Data Protection)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pan_encrypted TEXT NOT NULL,
    pan_masked VARCHAR(20) NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number_encrypted TEXT NOT NULL,
    account_number_masked VARCHAR(30) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_records(user_id);

CREATE TABLE IF NOT EXISTS referral_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    tds_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.0,
    tds_paise BIGINT NOT NULL DEFAULT 0,
    net_payout_paise BIGINT NOT NULL,
    pan_masked VARCHAR(20),
    bank_masked VARCHAR(30),
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'UNDER_REVIEW', 'ON_HOLD', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED')),
    notes TEXT,
    transaction_reference VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON referral_withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON referral_withdrawals(status);

-- -----------------------------------------------------------------------------
-- 5. CRM (Leads, Pipelines, Follow-ups, Calls)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    qualification VARCHAR(50) DEFAULT 'UNQUALIFIED',
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    employee_id UUID REFERENCES users(id),
    manager_id UUID REFERENCES users(id),
    pipeline_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_number ON crm_leads(lead_number);
CREATE INDEX IF NOT EXISTS idx_crm_leads_customer ON crm_leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_employee ON crm_leads(employee_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id),
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    duration_seconds INT DEFAULT 0,
    disposition VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. CMS & WEBSITE CONTENT BLOCKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255),
    content TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    claim_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    evidence TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    sections JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blogs (
    id VARCHAR(100) PRIMARY KEY,
    slug VARCHAR(150) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    author_name VARCHAR(150) NOT NULL,
    featured_image TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. AUDIT LOGS (Immutable History)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
