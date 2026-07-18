
-- 1) admin_access_logs: remove client-side insert; only service_role inserts.
DROP POLICY IF EXISTS "insert_own_access_log" ON public.admin_access_logs;
REVOKE INSERT ON public.admin_access_logs FROM authenticated, anon;

-- 2) alunos_destaque_historico: require author is admin or the professor who
-- indicated the destaque (or teacher of that destaque's turma).
DROP POLICY IF EXISTS alunos_destaque_hist_insert ON public.alunos_destaque_historico;
CREATE POLICY alunos_destaque_hist_insert ON public.alunos_destaque_historico
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      public.is_school_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.alunos_destaque d
        WHERE d.id = alunos_destaque_historico.destaque_id
          AND (
            d.indicado_por = auth.uid()
            OR public.is_professor_da_turma(auth.uid(), d.turma_id)
          )
      )
    )
  );
