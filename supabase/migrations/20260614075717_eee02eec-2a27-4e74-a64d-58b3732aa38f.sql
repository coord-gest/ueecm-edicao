-- Tighten EXECUTE on SECURITY DEFINER helpers: revoke from PUBLIC/anon,
-- keep only authenticated (needed by RLS policies that reference them).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_content(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_school_staff(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_content(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid) TO authenticated, service_role;

-- Trigger functions: only the postgres role / triggers should call these.
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;