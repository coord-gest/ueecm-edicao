-- Revoke EXECUTE on internal SECURITY DEFINER functions from API roles.
-- These are used only by RLS policies and triggers; they should not be callable via PostgREST.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.has_role(uuid, app_role)',
    'public.is_school_admin(uuid)',
    'public.is_professor_da_turma(uuid, uuid)',
    'public.is_professor_do_aluno(uuid, uuid)',
    'public.is_responsavel_do_aluno(uuid, uuid)',
    'public.handle_new_user()',
    'public.tg_audit_log()',
    'public.tg_alerts_enqueue_push()',
    'public.tg_posts_enqueue_push()',
    'public.tg_comunicado_enqueue_push()',
    'public.tg_push_queue_dispatch()',
    'public.tg_set_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % not found, skipping', fn;
    END;
  END LOOP;
END $$;