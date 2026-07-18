DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alunos','notas','frequencia','comunicados','aluno_responsavel','turmas_escolares','user_roles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER tg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log()', t, t);
  END LOOP;
END $$;