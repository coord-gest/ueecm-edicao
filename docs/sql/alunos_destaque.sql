-- ============================================================================
-- Alunos de Destaque do Mês
-- Execute este SQL no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/mhmdjjbqbbsgcsjujuhx/sql/new
-- ============================================================================

-- ---------- Enum de status ----------
DO $$ BEGIN
  CREATE TYPE public.aluno_destaque_status AS ENUM ('indicado', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Tabela ----------
CREATE TABLE IF NOT EXISTS public.alunos_destaque (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id        uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id        uuid NOT NULL REFERENCES public.turmas_escolares(id) ON DELETE CASCADE,
  disciplina_id   uuid REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  mes             date NOT NULL,
  motivo          text NOT NULL,
  posicao         smallint NOT NULL,
  exibir_foto     boolean NOT NULL DEFAULT false,
  foto_url        text,
  status          public.aluno_destaque_status NOT NULL DEFAULT 'indicado',
  indicado_por    uuid,
  aprovado_por    uuid,
  aprovado_em     timestamptz,
  motivo_rejeicao text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alunos_destaque_motivo_len CHECK (char_length(motivo) BETWEEN 5 AND 500),
  CONSTRAINT alunos_destaque_posicao_ok CHECK (posicao BETWEEN 1 AND 5),
  CONSTRAINT alunos_destaque_mes_dia1 CHECK (extract(day from mes) = 1)
);

-- Índice único evita duplicar a mesma posição na mesma turma/disciplina/mês.
-- Como disciplina_id pode ser NULL, usamos COALESCE para diferenciar destaque geral.
CREATE UNIQUE INDEX IF NOT EXISTS alunos_destaque_unique_pos
  ON public.alunos_destaque (turma_id, COALESCE(disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid), mes, posicao);

CREATE INDEX IF NOT EXISTS alunos_destaque_mes_idx ON public.alunos_destaque (mes DESC);
CREATE INDEX IF NOT EXISTS alunos_destaque_status_idx ON public.alunos_destaque (status);
CREATE INDEX IF NOT EXISTS alunos_destaque_aluno_idx ON public.alunos_destaque (aluno_id);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_alunos_destaque_updated_at ON public.alunos_destaque;
CREATE TRIGGER trg_alunos_destaque_updated_at
  BEFORE UPDATE ON public.alunos_destaque
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- GRANTs ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos_destaque TO authenticated;
GRANT ALL ON public.alunos_destaque TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.alunos_destaque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alunos_destaque_select_public ON public.alunos_destaque;
CREATE POLICY alunos_destaque_select_public ON public.alunos_destaque
  FOR SELECT TO anon, authenticated
  USING (status = 'aprovado');

DROP POLICY IF EXISTS alunos_destaque_select_staff ON public.alunos_destaque;
CREATE POLICY alunos_destaque_select_staff ON public.alunos_destaque
  FOR SELECT TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR public.is_professor_da_turma(auth.uid(), turma_id)
  );

DROP POLICY IF EXISTS alunos_destaque_insert_staff ON public.alunos_destaque;
CREATE POLICY alunos_destaque_insert_staff ON public.alunos_destaque
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(auth.uid())
    OR public.is_professor_da_turma(auth.uid(), turma_id)
  );

DROP POLICY IF EXISTS alunos_destaque_update_admin ON public.alunos_destaque;
CREATE POLICY alunos_destaque_update_admin ON public.alunos_destaque
  FOR UPDATE TO authenticated
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS alunos_destaque_delete_admin ON public.alunos_destaque;
CREATE POLICY alunos_destaque_delete_admin ON public.alunos_destaque
  FOR DELETE TO authenticated
  USING (public.is_school_admin(auth.uid()));

-- ---------- View pública ----------
DROP VIEW IF EXISTS public.alunos_destaque_publicos;
CREATE VIEW public.alunos_destaque_publicos
  WITH (security_invoker = on)
  AS
SELECT
  d.id,
  d.mes,
  d.posicao,
  d.motivo,
  CASE WHEN d.exibir_foto THEN d.foto_url ELSE NULL END AS foto_url,
  d.exibir_foto,
  a.id           AS aluno_id,
  a.nome_completo AS aluno_nome,
  t.id           AS turma_id,
  t.nome         AS turma_nome,
  t.ano_serie    AS turma_ano_serie,
  disc.id        AS disciplina_id,
  disc.nome      AS disciplina_nome,
  disc.cor       AS disciplina_cor
FROM public.alunos_destaque d
JOIN public.alunos a         ON a.id = d.aluno_id
JOIN public.turmas_escolares t ON t.id = d.turma_id
LEFT JOIN public.disciplinas disc ON disc.id = d.disciplina_id
WHERE d.status = 'aprovado';

GRANT SELECT ON public.alunos_destaque_publicos TO anon, authenticated;
