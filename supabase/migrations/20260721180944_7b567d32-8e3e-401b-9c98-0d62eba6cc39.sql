
-- Enum para tipo
DO $$ BEGIN
  CREATE TYPE public.merito_tipo AS ENUM ('elogio','avanco','atencao','ocorrencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.meritos_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas_escolares(id) ON DELETE SET NULL,
  autor_id uuid NOT NULL,
  autor_nome text,
  tipo public.merito_tipo NOT NULL,
  disciplina text,
  nota_original text NOT NULL,
  nota_construtiva text,
  ia_reescreveu boolean NOT NULL DEFAULT false,
  visivel_pais boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meritos_aluno_data ON public.meritos_ocorrencias(aluno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meritos_turma_data ON public.meritos_ocorrencias(turma_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meritos_autor ON public.meritos_ocorrencias(autor_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meritos_ocorrencias TO authenticated;
GRANT ALL ON public.meritos_ocorrencias TO service_role;

ALTER TABLE public.meritos_ocorrencias ENABLE ROW LEVEL SECURITY;

-- Professores da turma podem ler
CREATE POLICY meritos_read_professor ON public.meritos_ocorrencias
  FOR SELECT TO authenticated
  USING (
    public.is_professor_do_aluno(auth.uid(), aluno_id)
    OR public.is_school_admin(auth.uid())
  );

-- Responsáveis leem apenas registros visíveis dos seus filhos
CREATE POLICY meritos_read_responsavel ON public.meritos_ocorrencias
  FOR SELECT TO authenticated
  USING (visivel_pais IS TRUE AND public.is_responsavel_do_aluno(auth.uid(), aluno_id));

-- Autor cria (é professor do aluno ou admin escolar)
CREATE POLICY meritos_insert_autor ON public.meritos_ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      public.is_professor_do_aluno(auth.uid(), aluno_id)
      OR public.is_school_admin(auth.uid())
    )
  );

-- Autor edita o próprio
CREATE POLICY meritos_update_autor ON public.meritos_ocorrencias
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()))
  WITH CHECK (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

-- Autor apaga o próprio; admin apaga tudo
CREATE POLICY meritos_delete_autor ON public.meritos_ocorrencias
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE TRIGGER trg_meritos_updated_at BEFORE UPDATE ON public.meritos_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger: envia push para responsáveis do aluno
CREATE OR REPLACE FUNCTION public.tg_meritos_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno_nome text;
  v_target_users uuid[];
  v_titulo text;
  v_corpo text;
BEGIN
  IF NEW.visivel_pais IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT nome_completo INTO v_aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  SELECT array_agg(DISTINCT r.user_id)
    INTO v_target_users
  FROM public.aluno_responsavel ar
  JOIN public.responsaveis r ON r.id = ar.responsavel_id
  WHERE ar.aluno_id = NEW.aluno_id AND r.user_id IS NOT NULL;

  v_titulo := CASE NEW.tipo
    WHEN 'elogio' THEN '⭐ Elogio para ' || split_part(COALESCE(v_aluno_nome,'seu filho'),' ',1)
    WHEN 'avanco' THEN '📈 Avanço de ' || split_part(COALESCE(v_aluno_nome,'seu filho'),' ',1)
    WHEN 'atencao' THEN 'Atenção — ' || split_part(COALESCE(v_aluno_nome,'seu filho'),' ',1)
    WHEN 'ocorrencia' THEN 'Ocorrência — ' || split_part(COALESCE(v_aluno_nome,'seu filho'),' ',1)
  END;
  v_corpo := LEFT(COALESCE(NEW.nota_construtiva, NEW.nota_original), 240);

  IF v_target_users IS NOT NULL AND array_length(v_target_users,1) > 0 THEN
    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id, target_user_ids)
    VALUES (v_titulo, v_corpo, '/painel-radar-filho', 'merito', NEW.id, v_target_users);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meritos_push AFTER INSERT ON public.meritos_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_meritos_enqueue_push();
