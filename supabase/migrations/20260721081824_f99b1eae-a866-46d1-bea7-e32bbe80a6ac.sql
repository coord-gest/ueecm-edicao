
-- Atividades e Trabalhos
CREATE TABLE public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  turma_id uuid NOT NULL REFERENCES public.turmas_escolares(id) ON DELETE CASCADE,
  disciplina text,
  data_entrega timestamptz NOT NULL,
  professor_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX atividades_professor_idx ON public.atividades(professor_id);
CREATE INDEX atividades_turma_idx ON public.atividades(turma_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades TO authenticated;
GRANT ALL ON public.atividades TO service_role;

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor gerencia suas atividades"
  ON public.atividades FOR ALL
  TO authenticated
  USING (professor_id = auth.uid() OR public.is_school_admin(auth.uid()))
  WITH CHECK (professor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE TRIGGER trg_atividades_updated_at
  BEFORE UPDATE ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Entregas
CREATE TABLE public.atividade_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  entregue boolean NOT NULL DEFAULT true,
  entregue_em timestamptz NOT NULL DEFAULT now(),
  observacao text,
  marcado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(atividade_id, aluno_id)
);

CREATE INDEX atividade_entregas_atividade_idx ON public.atividade_entregas(atividade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_entregas TO authenticated;
GRANT ALL ON public.atividade_entregas TO service_role;

ALTER TABLE public.atividade_entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor gerencia entregas de suas atividades"
  ON public.atividade_entregas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.atividades a
      WHERE a.id = atividade_id
        AND (a.professor_id = auth.uid() OR public.is_school_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.atividades a
      WHERE a.id = atividade_id
        AND (a.professor_id = auth.uid() OR public.is_school_admin(auth.uid()))
    )
  );

CREATE TRIGGER trg_atividade_entregas_updated_at
  BEFORE UPDATE ON public.atividade_entregas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
