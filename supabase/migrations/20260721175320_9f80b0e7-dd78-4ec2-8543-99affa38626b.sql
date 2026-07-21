DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diario_tipo') THEN
    CREATE TYPE public.diario_tipo AS ENUM (
      'elogio','participacao','avanco','observacao','atencao'
    );
  END IF;
END $$;

CREATE TABLE public.diario_bordo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas_escolares(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  autor_nome text,
  data_registro date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
  tipo public.diario_tipo NOT NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 2 AND 200),
  descricao text CHECK (descricao IS NULL OR length(descricao) <= 2000),
  disciplina text CHECK (disciplina IS NULL OR length(disciplina) <= 80),
  visivel_pais boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX diario_bordo_aluno_data_idx    ON public.diario_bordo (aluno_id, data_registro DESC);
CREATE INDEX diario_bordo_turma_data_idx    ON public.diario_bordo (turma_id, data_registro DESC);
CREATE INDEX diario_bordo_autor_created_idx ON public.diario_bordo (autor_id, created_at DESC);
CREATE INDEX diario_bordo_tipo_data_idx     ON public.diario_bordo (tipo, data_registro DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_bordo TO authenticated;
GRANT ALL ON public.diario_bordo TO service_role;

ALTER TABLE public.diario_bordo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professor vê registros da sua turma"
  ON public.diario_bordo FOR SELECT TO authenticated
  USING (public.is_professor_da_turma(auth.uid(), turma_id));

CREATE POLICY "Professor cria registros na sua turma"
  ON public.diario_bordo FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND public.is_professor_da_turma(auth.uid(), turma_id)
    AND public.is_professor_do_aluno(auth.uid(), aluno_id)
  );

CREATE POLICY "Autor edita o próprio registro"
  ON public.diario_bordo FOR UPDATE TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "Autor exclui o próprio registro"
  ON public.diario_bordo FOR DELETE TO authenticated
  USING (autor_id = auth.uid());

CREATE POLICY "Gestão vê todos os registros"
  ON public.diario_bordo FOR SELECT TO authenticated
  USING (public.is_school_admin(auth.uid()));

CREATE POLICY "Gestão pode excluir"
  ON public.diario_bordo FOR DELETE TO authenticated
  USING (public.is_school_admin(auth.uid()));

CREATE POLICY "Responsável vê registros visíveis do filho"
  ON public.diario_bordo FOR SELECT TO authenticated
  USING (
    visivel_pais IS TRUE
    AND public.is_responsavel_do_aluno(auth.uid(), aluno_id)
  );

CREATE TRIGGER trg_diario_bordo_updated_at
  BEFORE UPDATE ON public.diario_bordo
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Leituras
CREATE TABLE public.diario_bordo_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES public.diario_bordo(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registro_id, user_id)
);

CREATE INDEX diario_leituras_user_idx ON public.diario_bordo_leituras (user_id, lido_em DESC);

GRANT SELECT, INSERT, DELETE ON public.diario_bordo_leituras TO authenticated;
GRANT ALL ON public.diario_bordo_leituras TO service_role;

ALTER TABLE public.diario_bordo_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê suas leituras"
  ON public.diario_bordo_leituras FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuário registra sua leitura"
  ON public.diario_bordo_leituras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário remove sua leitura"
  ON public.diario_bordo_leituras FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Push aos responsáveis
CREATE OR REPLACE FUNCTION public.tg_diario_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_users uuid[];
  v_aluno_nome text;
  v_tipo_label text;
BEGIN
  IF NEW.visivel_pais IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT ARRAY_AGG(DISTINCT r.user_id)
    INTO v_target_users
  FROM public.aluno_responsavel ar
  JOIN public.responsaveis r ON r.id = ar.responsavel_id
  WHERE ar.aluno_id = NEW.aluno_id
    AND r.user_id IS NOT NULL;

  IF v_target_users IS NULL OR array_length(v_target_users, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT split_part(a.nome_completo, ' ', 1)
    INTO v_aluno_nome
  FROM public.alunos a
  WHERE a.id = NEW.aluno_id;

  v_tipo_label := CASE NEW.tipo
    WHEN 'elogio'       THEN '⭐ Elogio'
    WHEN 'participacao' THEN '🙋 Participação'
    WHEN 'avanco'       THEN '📈 Avanço'
    WHEN 'observacao'   THEN '📝 Observação'
    WHEN 'atencao'      THEN '⚠️ Atenção'
    ELSE 'Registro'
  END;

  INSERT INTO public.push_notifications_queue
    (title, body, url, source, source_id, target_user_ids)
  VALUES (
    v_tipo_label || ' — ' || COALESCE(v_aluno_nome, 'seu filho'),
    LEFT(NEW.titulo || COALESCE(': ' || NEW.descricao, ''), 220),
    '/painel-diario-filho',
    'diario_bordo',
    NEW.id,
    v_target_users
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[tg_diario_enqueue_push] erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_diario_enqueue_push
  AFTER INSERT ON public.diario_bordo
  FOR EACH ROW EXECUTE FUNCTION public.tg_diario_enqueue_push();

-- Contador de não lidos por filho
CREATE OR REPLACE FUNCTION public.contar_diario_nao_lidos()
RETURNS TABLE(aluno_id uuid, nao_lidos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.aluno_id, count(*)::bigint AS nao_lidos
  FROM public.diario_bordo d
  JOIN public.aluno_responsavel ar ON ar.aluno_id = d.aluno_id
  JOIN public.responsaveis r ON r.id = ar.responsavel_id
  WHERE r.user_id = auth.uid()
    AND d.visivel_pais IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.diario_bordo_leituras l
      WHERE l.registro_id = d.id AND l.user_id = auth.uid()
    )
  GROUP BY d.aluno_id;
$$;

GRANT EXECUTE ON FUNCTION public.contar_diario_nao_lidos() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.contar_diario_nao_lidos() FROM anon;