-- ============================================================================
-- Alunos de Destaque do Mês — v2
-- Adiciona: histórico de alterações + permissões para o professor
-- editar/cancelar a própria indicação enquanto status = 'indicado'.
-- ============================================================================

-- Histórico de alterações
CREATE TABLE IF NOT EXISTS public.alunos_destaque_historico (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destaque_id  uuid NOT NULL REFERENCES public.alunos_destaque(id) ON DELETE CASCADE,
  acao         text NOT NULL,
  autor_id     uuid,
  before       jsonb,
  after        jsonb,
  observacao   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alunos_destaque_hist_destaque_idx
  ON public.alunos_destaque_historico (destaque_id, created_at DESC);

GRANT SELECT, INSERT ON public.alunos_destaque_historico TO authenticated;
GRANT ALL ON public.alunos_destaque_historico TO service_role;

ALTER TABLE public.alunos_destaque_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alunos_destaque_hist_select ON public.alunos_destaque_historico;
CREATE POLICY alunos_destaque_hist_select ON public.alunos_destaque_historico
  FOR SELECT TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR autor_id = auth.uid()
  );

DROP POLICY IF EXISTS alunos_destaque_hist_insert ON public.alunos_destaque_historico;
CREATE POLICY alunos_destaque_hist_insert ON public.alunos_destaque_historico
  FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());

-- Ajusta UPDATE para permitir professor editar sua própria indicação
DROP POLICY IF EXISTS alunos_destaque_update_admin ON public.alunos_destaque;
CREATE POLICY alunos_destaque_update_admin ON public.alunos_destaque
  FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR (status = 'indicado' AND indicado_por = auth.uid())
  )
  WITH CHECK (
    public.is_school_admin(auth.uid())
    OR (status = 'indicado' AND indicado_por = auth.uid())
  );

-- Ajusta DELETE para permitir professor cancelar sua própria indicação
DROP POLICY IF EXISTS alunos_destaque_delete_admin ON public.alunos_destaque;
CREATE POLICY alunos_destaque_delete_admin ON public.alunos_destaque
  FOR DELETE TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR (status = 'indicado' AND indicado_por = auth.uid())
  );
