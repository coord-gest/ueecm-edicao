-- 1. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated
-- These functions are called by RLS policies and triggers (which run as definer),
-- so revoking direct EXECUTE does not affect app behavior.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_approve(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_audit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

-- 2. Restrict posts-media bucket: drop broad SELECT policy on storage.objects.
-- Bucket remains public, so files keep working via direct public URL,
-- but anonymous listing of all files is blocked.
DROP POLICY IF EXISTS "Public read posts-media" ON storage.objects;
DROP POLICY IF EXISTS "posts-media public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on posts-media" ON storage.objects;
DROP POLICY IF EXISTS "posts-media: leitura pública" ON storage.objects;