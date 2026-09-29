-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 010
-- PAYMENTS, WEBHOOK IDEMPOTENCY, PLATFORM SETTINGS, ASSETS & COUNTERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100),
    payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_eid ON processed_events(event_id);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100) UNIQUE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'captured',
    method VARCHAR(50),
    raw_response JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_rzp_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_rzp_payment ON payments(razorpay_payment_id);

CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot VARCHAR(100) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    alt TEXT,
    width INT,
    height INT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_slot ON assets(slot);

CREATE TABLE IF NOT EXISTS counters (
    id VARCHAR(100) PRIMARY KEY,
    seq BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS status_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_checks_ts ON status_checks(timestamp DESC);
