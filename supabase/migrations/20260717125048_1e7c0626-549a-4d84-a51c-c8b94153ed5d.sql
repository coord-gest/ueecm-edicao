
-- 1) Tighten UPDATE policies: prevent tampering with ownership/immutable columns
DROP POLICY IF EXISTS mc_update ON public.mensagens_coordenacao;
CREATE POLICY mc_update ON public.mensagens_coordenacao
  FOR UPDATE
  USING ((remetente_id = auth.uid()) OR public.is_school_admin(auth.uid()))
  WITH CHECK ((remetente_id = auth.uid()) OR public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS jf_update ON public.justificativas_faltas;
CREATE POLICY jf_update ON public.justificativas_faltas
  FOR UPDATE
  USING (public.is_school_admin(auth.uid()) OR public.is_professor_do_aluno(auth.uid(), aluno_id))
  WITH CHECK (public.is_school_admin(auth.uid()) OR public.is_professor_do_aluno(auth.uid(), aluno_id));

-- 2) Revoke EXECUTE from anon on SECURITY DEFINER functions that aren't public
REVOKE EXECUTE ON FUNCTION public.can_delete_arquivo_preenchimento(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_patrocinadores(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_admin_access_logs() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_professor_or_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_professor_para_profissionais() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_dispatch_push() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_push(text) FROM anon;

-- Trigger-only functions: revoke from public roles (only triggers/superuser invoke them)
REVOKE EXECUTE ON FUNCTION public.tg_audit_arquivo_preench_delete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_dsr_enqueue_push() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_dsr_rate_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_familias_depoimentos_before_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_mensagem_coord_push() FROM anon, authenticated;
