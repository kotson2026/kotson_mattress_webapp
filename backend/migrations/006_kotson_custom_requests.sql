-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 006
-- CUSTOM PRODUCT REQUESTS (BESPOKE MATTRESSES & BEDDING)
-- =============================================================================

CREATE TABLE IF NOT EXISTS custom_product_requests (
    id VARCHAR(100) PRIMARY KEY,
    request_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    city VARCHAR(100),
    pincode VARCHAR(20),
    product_id VARCHAR(100),
    product_name_snapshot VARCHAR(255) NOT NULL,
    product_slug VARCHAR(150),
    category VARCHAR(100),
    product_image TEXT,
    size_mode VARCHAR(50) NOT NULL DEFAULT 'custom',
    standard_variant_id VARCHAR(100),
    standard_size_label VARCHAR(100),
    length VARCHAR(50) NOT NULL,
    breadth VARCHAR(50) NOT NULL,
    height_or_thickness VARCHAR(50) NOT NULL,
    measurement_unit VARCHAR(20) NOT NULL DEFAULT 'inch',
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    customer_remarks TEXT,
    internal_remarks TEXT,
    quoted_price NUMERIC(12, 2),
    quote_notes TEXT,
    quote_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_req_number ON custom_product_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_custom_req_customer ON custom_product_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_custom_req_status ON custom_product_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_req_created ON custom_product_requests(created_at DESC);
