-- Revoke direct EXECUTE from anon/authenticated on SECURITY DEFINER helpers.
-- They stay callable from RLS policies (owner privileges) and service_role.

DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'has_role',
        'is_school_admin',
        'is_professor_da_turma',
        'is_professor_do_aluno',
        'is_responsavel_do_aluno',
        'admin_list_profissionais',
        'enqueue_due_alert_pushes',
        'cleanup_audit_logs',
        'cleanup_analytics_events',
        'cleanup_system_errors'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated, public;', fn, sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', fn, sig);
  END LOOP;
END $$;