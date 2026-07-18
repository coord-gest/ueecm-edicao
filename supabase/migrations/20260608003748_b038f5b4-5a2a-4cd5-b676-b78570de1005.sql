-- Revoke public/anon EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_school_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_content(uuid) TO authenticated;

-- Tighten audit_logs INSERT policy (writes happen via SECURITY DEFINER trigger)
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT TO service_role
  WITH CHECK (true);