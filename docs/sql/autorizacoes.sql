-- =====================================================================
-- Painel do Responsável — Autorizações digitais
-- Rodar no SQL Editor do Supabase (mhmdjjbqbbsgcsjujuhx)
-- =====================================================================

-- 1) Tabela de autorizações (evento/passeio/saída) criada pela escola
CREATE TABLE IF NOT EXISTS public.autorizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL,
  data_evento date,
  prazo_resposta timestamptz,
  turma_ids uuid[] NOT NULL DEFAULT '{}',
  aluno_ids uuid[] NOT NULL DEFAULT '{}',
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.autorizacoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.autorizacoes TO authenticated;
GRANT ALL ON public.autorizacoes TO service_role;

ALTER TABLE public.autorizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autorizacoes_select_all_auth" ON public.autorizacoes;
CREATE POLICY "autorizacoes_select_all_auth" ON public.autorizacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "autorizacoes_manage_staff" ON public.autorizacoes;
CREATE POLICY "autorizacoes_manage_staff" ON public.autorizacoes
  FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid()) OR public.is_professor_or_staff(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()) OR public.is_professor_or_staff(auth.uid()));

CREATE TRIGGER trg_autorizacoes_updated
  BEFORE UPDATE ON public.autorizacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Respostas (assinatura digital do responsável por aluno)
CREATE TABLE IF NOT EXISTS public.autorizacao_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autorizacao_id uuid NOT NULL REFERENCES public.autorizacoes(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  respondido_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autorizado boolean NOT NULL,
  observacao text,
  assinatura_nome text NOT NULL,
  ip_address text,
  user_agent text,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (autorizacao_id, aluno_id)
);

GRANT SELECT, INSERT, UPDATE ON public.autorizacao_respostas TO authenticated;
GRANT ALL ON public.autorizacao_respostas TO service_role;

ALTER TABLE public.autorizacao_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autrespostas_select" ON public.autorizacao_respostas;
CREATE POLICY "autrespostas_select" ON public.autorizacao_respostas
  FOR SELECT TO authenticated
  USING (
    respondido_por = auth.uid()
    OR public.is_school_admin(auth.uid())
    OR public.is_professor_do_aluno(auth.uid(), aluno_id)
    OR public.is_responsavel_do_aluno(auth.uid(), aluno_id)
  );

DROP POLICY IF EXISTS "autrespostas_insert_responsavel" ON public.autorizacao_respostas;
CREATE POLICY "autrespostas_insert_responsavel" ON public.autorizacao_respostas
  FOR INSERT TO authenticated
  WITH CHECK (
    respondido_por = auth.uid()
    AND public.is_responsavel_do_aluno(auth.uid(), aluno_id)
  );

DROP POLICY IF EXISTS "autrespostas_update_own" ON public.autorizacao_respostas;
CREATE POLICY "autrespostas_update_own" ON public.autorizacao_respostas
  FOR UPDATE TO authenticated
  USING (respondido_por = auth.uid())
  WITH CHECK (respondido_por = auth.uid());

CREATE INDEX IF NOT EXISTS idx_autresp_autorizacao ON public.autorizacao_respostas(autorizacao_id);
CREATE INDEX IF NOT EXISTS idx_autresp_aluno ON public.autorizacao_respostas(aluno_id);
