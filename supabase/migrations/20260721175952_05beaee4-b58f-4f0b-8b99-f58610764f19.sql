
-- =========================================================
-- ENUM de tipo do registro
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diario_bordo_tipo') THEN
    CREATE TYPE public.diario_bordo_tipo AS ENUM (
      'elogio','participacao','avanco','observacao','atencao'
    );
  END IF;
END $$;

-- =========================================================
-- Tabela principal
-- =========================================================
CREATE TABLE IF NOT EXISTS public.diario_bordo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas_escolares(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  autor_nome TEXT,
  tipo public.diario_bordo_tipo NOT NULL,
  titulo TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 200),
  descricao TEXT CHECK (descricao IS NULL OR length(descricao) <= 2000),
  disciplina TEXT CHECK (disciplina IS NULL OR length(disciplina) <= 80),
  visivel_pais BOOLEAN NOT NULL DEFAULT TRUE,
  data_registro DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_bordo TO authenticated;
GRANT ALL ON public.diario_bordo TO service_role;

ALTER TABLE public.diario_bordo ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS diario_bordo_turma_data_idx
  ON public.diario_bordo (turma_id, data_registro DESC);
CREATE INDEX IF NOT EXISTS diario_bordo_aluno_data_idx
  ON public.diario_bordo (aluno_id, data_registro DESC);
CREATE INDEX IF NOT EXISTS diario_bordo_autor_idx
  ON public.diario_bordo (autor_id);

-- updated_at
DROP TRIGGER IF EXISTS tg_diario_bordo_updated_at ON public.diario_bordo;
CREATE TRIGGER tg_diario_bordo_updated_at
BEFORE UPDATE ON public.diario_bordo
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Policies
-- =========================================================
DROP POLICY IF EXISTS diario_prof_select ON public.diario_bordo;
CREATE POLICY diario_prof_select ON public.diario_bordo
  FOR SELECT TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR public.is_professor_da_turma(auth.uid(), turma_id)
    OR (visivel_pais IS TRUE AND public.is_responsavel_do_aluno(auth.uid(), aluno_id))
  );

DROP POLICY IF EXISTS diario_prof_insert ON public.diario_bordo;
CREATE POLICY diario_prof_insert ON public.diario_bordo
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      public.is_school_admin(auth.uid())
      OR public.is_professor_da_turma(auth.uid(), turma_id)
    )
  );

DROP POLICY IF EXISTS diario_prof_update ON public.diario_bordo;
CREATE POLICY diario_prof_update ON public.diario_bordo
  FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR (autor_id = auth.uid() AND public.is_professor_da_turma(auth.uid(), turma_id))
  )
  WITH CHECK (
    public.is_school_admin(auth.uid())
    OR (autor_id = auth.uid() AND public.is_professor_da_turma(auth.uid(), turma_id))
  );

DROP POLICY IF EXISTS diario_prof_delete ON public.diario_bordo;
CREATE POLICY diario_prof_delete ON public.diario_bordo
  FOR DELETE TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR (autor_id = auth.uid() AND public.is_professor_da_turma(auth.uid(), turma_id))
  );

-- =========================================================
-- Tabela de leituras (marcador do responsável / aluno)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.diario_bordo_leituras (
  registro_id UUID NOT NULL REFERENCES public.diario_bordo(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (registro_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.diario_bordo_leituras TO authenticated;
GRANT ALL ON public.diario_bordo_leituras TO service_role;

ALTER TABLE public.diario_bordo_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diario_leituras_own ON public.diario_bordo_leituras;
CREATE POLICY diario_leituras_own ON public.diario_bordo_leituras
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================
-- Função: contar não lidos por filho (responsável logado)
-- =========================================================
CREATE OR REPLACE FUNCTION public.contar_diario_nao_lidos()
RETURNS TABLE(aluno_id UUID, nao_lidos BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.aluno_id, COUNT(*)::bigint AS nao_lidos
  FROM public.diario_bordo d
  WHERE d.visivel_pais IS TRUE
    AND public.is_responsavel_do_aluno(auth.uid(), d.aluno_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.diario_bordo_leituras l
      WHERE l.registro_id = d.id AND l.user_id = auth.uid()
    )
  GROUP BY d.aluno_id;
$$;

GRANT EXECUTE ON FUNCTION public.contar_diario_nao_lidos() TO authenticated;

-- =========================================================
-- Trigger: enfileira push aos responsáveis quando visível
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_diario_enqueue_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
  v_titulo TEXT;
  v_body TEXT;
BEGIN
  IF NEW.visivel_pais IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Coleta os user_ids dos responsáveis do aluno
  SELECT ARRAY(
    SELECT DISTINCT r.user_id
    FROM public.aluno_responsavel ar
    JOIN public.responsaveis r ON r.id = ar.responsavel_id
    WHERE ar.aluno_id = NEW.aluno_id
      AND r.user_id IS NOT NULL
  ) INTO v_user_ids;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_titulo := CASE NEW.tipo
    WHEN 'elogio'       THEN 'Novo elogio no diário'
    WHEN 'participacao' THEN 'Nova participação registrada'
    WHEN 'avanco'       THEN 'Avanço registrado'
    WHEN 'observacao'   THEN 'Nova observação'
    WHEN 'atencao'      THEN 'Ponto de atenção'
    ELSE 'Novo registro no diário'
  END;

  v_body := LEFT(COALESCE(NEW.titulo, ''), 240);

  INSERT INTO public.push_notifications_queue
    (title, body, url, source, source_id, target_user_ids)
  VALUES (
    v_titulo, v_body, '/painel-diario-filho', 'diario_bordo', NEW.id, v_user_ids
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_diario_enqueue_push_ins ON public.diario_bordo;
CREATE TRIGGER tg_diario_enqueue_push_ins
AFTER INSERT ON public.diario_bordo
FOR EACH ROW EXECUTE FUNCTION public.tg_diario_enqueue_push();
