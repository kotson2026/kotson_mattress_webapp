-- Migration 018: Storage Admin Policies for kotson-media bucket
-- Allows authenticated staff and admin/owner to upload, update, and manage media assets safely.

DROP POLICY IF EXISTS "Staff and Admin Insert kotson-media" ON storage.objects;
CREATE POLICY "Staff and Admin Insert kotson-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kotson-media' AND (public.is_admin_or_owner() OR public.is_staff()));

DROP POLICY IF EXISTS "Staff and Admin Update kotson-media" ON storage.objects;
CREATE POLICY "Staff and Admin Update kotson-media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kotson-media' AND (public.is_admin_or_owner() OR public.is_staff()))
WITH CHECK (bucket_id = 'kotson-media');

DROP POLICY IF EXISTS "Staff and Admin Delete kotson-media" ON storage.objects;
CREATE POLICY "Staff and Admin Delete kotson-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kotson-media' AND (public.is_admin_or_owner() OR public.is_staff()));

INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('018', NOW())
ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at;
