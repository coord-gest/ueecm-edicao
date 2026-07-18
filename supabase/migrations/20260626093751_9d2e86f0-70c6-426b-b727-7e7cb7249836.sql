
-- ============= FASE 1: Módulo Escolar — Schema, RLS, Helpers =============

-- 1) TABELAS

CREATE TABLE public.turmas_escolares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano_serie text NOT NULL,
  turno text NOT NULL CHECK (turno IN ('manha','tarde','noite','integral')),
  ano_letivo integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  professor_responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, ano_letivo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas_escolares TO authenticated;
GRANT ALL ON public.turmas_escolares TO service_role;
ALTER TABLE public.turmas_escolares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  matricula text NOT NULL UNIQUE,
  turma_id uuid REFERENCES public.turmas_escolares(id) ON DELETE SET NULL,
  data_nascimento date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT ALL ON public.alunos TO service_role;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alunos_turma ON public.alunos(turma_id);

CREATE TABLE public.responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis TO authenticated;
GRANT ALL ON public.responsaveis TO service_role;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_responsaveis_user ON public.responsaveis(user_id);
CREATE INDEX idx_responsaveis_email ON public.responsaveis(lower(email));

CREATE TABLE public.aluno_responsavel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  responsavel_id uuid NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  parentesco text,
  principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, responsavel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aluno_responsavel TO authenticated;
GRANT ALL ON public.aluno_responsavel TO service_role;
ALTER TABLE public.aluno_responsavel ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alres_aluno ON public.aluno_responsavel(aluno_id);
CREATE INDEX idx_alres_responsavel ON public.aluno_responsavel(responsavel_id);

CREATE TABLE public.notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  disciplina text NOT NULL,
  bimestre smallint NOT NULL CHECK (bimestre BETWEEN 1 AND 4),
  valor numeric(4,2),
  observacao text,
  lancado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated;
GRANT ALL ON public.notas TO service_role;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notas_aluno ON public.notas(aluno_id);

CREATE TABLE public.frequencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data date NOT NULL,
  presente boolean NOT NULL DEFAULT true,
  justificativa text,
  registrado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia TO authenticated;
GRANT ALL ON public.frequencia TO service_role;
ALTER TABLE public.frequencia ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_freq_aluno_data ON public.frequencia(aluno_id, data DESC);

CREATE TABLE public.comunicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('turma','individual')),
  turma_id uuid REFERENCES public.turmas_escolares(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'turma' AND turma_id IS NOT NULL) OR
    (tipo = 'individual' AND aluno_id IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicados TO authenticated;
GRANT ALL ON public.comunicados TO service_role;
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_com_turma ON public.comunicados(turma_id);
CREATE INDEX idx_com_aluno ON public.comunicados(aluno_id);

CREATE TABLE public.comunicado_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id uuid NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comunicado_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunicado_leituras TO authenticated;
GRANT ALL ON public.comunicado_leituras TO service_role;
ALTER TABLE public.comunicado_leituras ENABLE ROW LEVEL SECURITY;

-- 2) FUNÇÕES HELPER (SECURITY DEFINER, evitam recursão de RLS)

CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','diretor','coordenador','secretario','desenvolvedor','developer','director','coordinator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_professor_da_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.turmas_escolares t
    WHERE t.id = _turma_id AND t.professor_responsavel_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_professor_do_aluno(_user_id uuid, _aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.alunos a
    JOIN public.turmas_escolares t ON t.id = a.turma_id
    WHERE a.id = _aluno_id AND t.professor_responsavel_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_responsavel_do_aluno(_user_id uuid, _aluno_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.aluno_responsavel ar
    JOIN public.responsaveis r ON r.id = ar.responsavel_id
    WHERE ar.aluno_id = _aluno_id AND r.user_id = _user_id
  );
$$;

-- 3) POLÍTICAS RLS

-- turmas_escolares
CREATE POLICY "turmas select admin" ON public.turmas_escolares FOR SELECT
  USING (public.is_school_admin(auth.uid()));
CREATE POLICY "turmas select professor" ON public.turmas_escolares FOR SELECT
  USING (professor_responsavel_id = auth.uid());
CREATE POLICY "turmas select responsavel" ON public.turmas_escolares FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.alunos a
    JOIN public.aluno_responsavel ar ON ar.aluno_id = a.id
    JOIN public.responsaveis r ON r.id = ar.responsavel_id
    WHERE a.turma_id = turmas_escolares.id AND r.user_id = auth.uid()
  ));
CREATE POLICY "turmas write admin" ON public.turmas_escolares FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

-- alunos
CREATE POLICY "alunos select admin" ON public.alunos FOR SELECT
  USING (public.is_school_admin(auth.uid()));
CREATE POLICY "alunos select professor" ON public.alunos FOR SELECT
  USING (turma_id IS NOT NULL AND public.is_professor_da_turma(auth.uid(), turma_id));
CREATE POLICY "alunos select responsavel" ON public.alunos FOR SELECT
  USING (public.is_responsavel_do_aluno(auth.uid(), id));
CREATE POLICY "alunos write admin" ON public.alunos FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "alunos update professor" ON public.alunos FOR UPDATE
  USING (turma_id IS NOT NULL AND public.is_professor_da_turma(auth.uid(), turma_id))
  WITH CHECK (turma_id IS NOT NULL AND public.is_professor_da_turma(auth.uid(), turma_id));

-- responsaveis
CREATE POLICY "responsaveis admin all" ON public.responsaveis FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "responsaveis self select" ON public.responsaveis FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "responsaveis self update" ON public.responsaveis FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "responsaveis professor select" ON public.responsaveis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.aluno_responsavel ar
    JOIN public.alunos a ON a.id = ar.aluno_id
    JOIN public.turmas_escolares t ON t.id = a.turma_id
    WHERE ar.responsavel_id = responsaveis.id
      AND t.professor_responsavel_id = auth.uid()
  ));

-- aluno_responsavel
CREATE POLICY "alres admin all" ON public.aluno_responsavel FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "alres professor select" ON public.aluno_responsavel FOR SELECT
  USING (public.is_professor_do_aluno(auth.uid(), aluno_id));
CREATE POLICY "alres responsavel select" ON public.aluno_responsavel FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.responsaveis r
    WHERE r.id = aluno_responsavel.responsavel_id AND r.user_id = auth.uid()
  ));

-- notas
CREATE POLICY "notas admin all" ON public.notas FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "notas professor all" ON public.notas FOR ALL
  USING (public.is_professor_do_aluno(auth.uid(), aluno_id))
  WITH CHECK (public.is_professor_do_aluno(auth.uid(), aluno_id));
CREATE POLICY "notas responsavel select" ON public.notas FOR SELECT
  USING (public.is_responsavel_do_aluno(auth.uid(), aluno_id));

-- frequencia
CREATE POLICY "freq admin all" ON public.frequencia FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "freq professor all" ON public.frequencia FOR ALL
  USING (public.is_professor_do_aluno(auth.uid(), aluno_id))
  WITH CHECK (public.is_professor_do_aluno(auth.uid(), aluno_id));
CREATE POLICY "freq responsavel select" ON public.frequencia FOR SELECT
  USING (public.is_responsavel_do_aluno(auth.uid(), aluno_id));

-- comunicados
CREATE POLICY "com admin all" ON public.comunicados FOR ALL
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));
CREATE POLICY "com autor select" ON public.comunicados FOR SELECT
  USING (autor_id = auth.uid());
CREATE POLICY "com professor insert" ON public.comunicados FOR INSERT
  WITH CHECK (
    autor_id = auth.uid() AND (
      (tipo = 'turma' AND public.is_professor_da_turma(auth.uid(), turma_id)) OR
      (tipo = 'individual' AND public.is_professor_do_aluno(auth.uid(), aluno_id))
    )
  );
CREATE POLICY "com turma select responsavel" ON public.comunicados FOR SELECT
  USING (tipo = 'turma' AND EXISTS (
    SELECT 1 FROM public.alunos a
    WHERE a.turma_id = comunicados.turma_id
      AND public.is_responsavel_do_aluno(auth.uid(), a.id)
  ));
CREATE POLICY "com individual select responsavel" ON public.comunicados FOR SELECT
  USING (tipo = 'individual' AND public.is_responsavel_do_aluno(auth.uid(), aluno_id));
CREATE POLICY "com turma select professor" ON public.comunicados FOR SELECT
  USING (tipo = 'turma' AND turma_id IS NOT NULL AND public.is_professor_da_turma(auth.uid(), turma_id));

-- comunicado_leituras
CREATE POLICY "leit self all" ON public.comunicado_leituras FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "leit admin select" ON public.comunicado_leituras FOR SELECT
  USING (public.is_school_admin(auth.uid()));

-- 4) TRIGGERS updated_at
CREATE TRIGGER trg_turmas_updated BEFORE UPDATE ON public.turmas_escolares
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_alunos_updated BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_responsaveis_updated BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) AUDITORIA (reaproveita tg_audit_log existente)
CREATE TRIGGER trg_audit_alunos AFTER INSERT OR UPDATE OR DELETE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER trg_audit_notas AFTER INSERT OR UPDATE OR DELETE ON public.notas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER trg_audit_comunicados AFTER INSERT OR UPDATE OR DELETE ON public.comunicados
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER trg_audit_alres AFTER INSERT OR UPDATE OR DELETE ON public.aluno_responsavel
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- 6) PUSH para comunicados (reaproveita push_notifications_queue)
CREATE OR REPLACE FUNCTION public.tg_comunicado_enqueue_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
  VALUES (
    COALESCE(NEW.titulo, 'Novo comunicado'),
    LEFT(NEW.mensagem, 240),
    '/escola/comunicados/' || NEW.id::text,
    'comunicado',
    NEW.id
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_comunicado_push AFTER INSERT ON public.comunicados
  FOR EACH ROW EXECUTE FUNCTION public.tg_comunicado_enqueue_push();
