-- =============================================================================
-- KOTSON PRODUCTION POSTGRESQL / SUPABASE MIGRATION 005
-- AUTHENTICATION & PASSWORD RESET TOKENS
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(30) NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'password_reset',
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwd_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_pwd_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_resets_expires_at ON password_resets(expires_at);
