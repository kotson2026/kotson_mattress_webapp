-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 009
-- DISPATCH, LOGISTICS CARRIERS, SHIPMENTS, RETURNS, REFUNDS & STOCK POINT
-- =============================================================================

CREATE TABLE IF NOT EXISTS carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    service_type VARCHAR(100),
    api_connected BOOLEAN NOT NULL DEFAULT FALSE,
    tracking_url_pattern TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carriers_code ON carriers(code);

CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(100) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    awb_number VARCHAR(100) NOT NULL,
    tracking_reference VARCHAR(100),
    tracking_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'MANIFESTED',
    shipping_address JSONB,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    events JSONB NOT NULL DEFAULT '[]'::JSONB,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_number ON shipments(shipment_number);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

CREATE TABLE IF NOT EXISTS return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(100) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    kind VARCHAR(50) NOT NULL DEFAULT 'return',
    reason TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'requested',
    inspection JSONB,
    restocked BOOLEAN NOT NULL DEFAULT FALSE,
    policy_version VARCHAR(100),
    raised_by VARCHAR(255),
    raised_by_role VARCHAR(100),
    trail JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_number ON return_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_returns_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON return_requests(status);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id VARCHAR(100) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    return_id UUID REFERENCES return_requests(id) ON DELETE SET NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    refund_type VARCHAR(50) NOT NULL DEFAULT 'FULL',
    refund_method VARCHAR(50) NOT NULL DEFAULT 'ORIGINAL_PAYMENT',
    reference_number VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_return ON refunds(return_id);

CREATE TABLE IF NOT EXISTS stock_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(100) UNIQUE NOT NULL,
    dispatch_type VARCHAR(50) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    reference_number VARCHAR(100),
    destination JSONB,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'DISPATCHED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_disp_num ON stock_dispatches(dispatch_number);
CREATE INDEX IF NOT EXISTS idx_stock_disp_order ON stock_dispatches(order_id);

CREATE TABLE IF NOT EXISTS stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type VARCHAR(50) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id VARCHAR(100),
    manual_stock_item_id VARCHAR(100),
    product_name VARCHAR(255),
    category VARCHAR(100),
    variant_size VARCHAR(100),
    sku VARCHAR(100),
    unit VARCHAR(20) NOT NULL DEFAULT 'piece',
    transaction_type VARCHAR(50) NOT NULL,
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    dispatch_id UUID,
    dispatch_number VARCHAR(100),
    dispatch_type VARCHAR(50),
    order_id UUID,
    reference_number VARCHAR(100),
    supplier VARCHAR(255),
    package_contents_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_tx_sku ON stock_transactions(sku);
CREATE INDEX IF NOT EXISTS idx_stock_tx_created ON stock_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS manual_stock_items (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'piece',
    stock INT NOT NULL DEFAULT 0,
    min_threshold INT NOT NULL DEFAULT 5,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_stock_sku ON manual_stock_items(sku);
