-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 007
-- DEALERS, DEALER PRICING RULES & DEALER B2B ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS dealers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_name VARCHAR(255) NOT NULL,
    gstin VARCHAR(50),
    pan VARCHAR(50),
    business_type VARCHAR(100),
    years_in_business INT,
    annual_turnover VARCHAR(100),
    address JSONB NOT NULL DEFAULT '{}'::JSONB,
    contact_person VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    territory VARCHAR(150),
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    credit_days INT NOT NULL DEFAULT 30,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealers_user_id ON dealers(user_id);
CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealers(status);
CREATE INDEX IF NOT EXISTS idx_dealers_org_name ON dealers(org_name);

CREATE TABLE IF NOT EXISTS dealer_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(100),
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL DEFAULT 'PERCENTAGE',
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_qty INT NOT NULL DEFAULT 1,
    credit_days INT NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlr_rules_dealer ON dealer_pricing_rules(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dlr_rules_product ON dealer_pricing_rules(product_id);

CREATE TABLE IF NOT EXISTS dealer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE RESTRICT,
    org_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(50),
    items JSONB NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    fulfilment_status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
    shipping_address JSONB,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlr_orders_dealer ON dealer_orders(dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlr_orders_number ON dealer_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_dlr_orders_status ON dealer_orders(status);
