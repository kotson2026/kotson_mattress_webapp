-- Migration 017: Security Definer Search Path Hardening & Parity Check
-- Ensures all SECURITY DEFINER functions have explicit search_path = public, pg_temp

ALTER FUNCTION public.protect_user_fields() SET search_path = public, pg_temp;

INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('017', NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at;
