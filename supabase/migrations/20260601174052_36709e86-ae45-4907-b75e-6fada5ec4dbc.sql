-- Eventos: adicionar coluna turma
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS turma text;

-- Horários: nova tabela
CREATE TABLE public.horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE CASCADE,
  professor text NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 6),
  turno text NOT NULL CHECK (turno IN ('manha','tarde','noite')),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  ordem smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_horarios_turma ON public.horarios(turma_id);
CREATE INDEX idx_horarios_disciplina ON public.horarios(disciplina_id);

GRANT SELECT ON public.horarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios TO authenticated;
GRANT ALL ON public.horarios TO service_role;

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Horarios: leitura pública"
  ON public.horarios FOR SELECT TO public USING (true);

CREATE POLICY "Horarios: gestão"
  ON public.horarios FOR ALL TO authenticated
  USING (public.is_manager(auth.uid()))
  WITH CHECK (public.is_manager(auth.uid()));