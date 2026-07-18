-- =====================================================================
-- Painel do Responsável — Fase 2
-- #5 Justificar faltas  |  #6 Agendar reunião (usa `agendamentos`)
-- #7 Chat com coordenação
-- =====================================================================

-- ============ #5 JUSTIFICATIVAS DE FALTAS ============
CREATE TABLE IF NOT EXISTS public.justificativas_faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  solicitante_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text NOT NULL,
  arquivo_url text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
  resposta_observacao text,
  respondido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.justificativas_faltas TO authenticated;
GRANT ALL ON public.justificativas_faltas TO service_role;
ALTER TABLE public.justificativas_faltas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jf_select" ON public.justificativas_faltas;
CREATE POLICY "jf_select" ON public.justificativas_faltas
  FOR SELECT TO authenticated
  USING (
    solicitante_user_id = auth.uid()
    OR public.is_school_admin(auth.uid())
    OR public.is_professor_do_aluno(auth.uid(), aluno_id)
    OR public.is_responsavel_do_aluno(auth.uid(), aluno_id)
  );

DROP POLICY IF EXISTS "jf_insert_resp" ON public.justificativas_faltas;
CREATE POLICY "jf_insert_resp" ON public.justificativas_faltas
  FOR INSERT TO authenticated
  WITH CHECK (
    solicitante_user_id = auth.uid()
    AND public.is_responsavel_do_aluno(auth.uid(), aluno_id)
  );

DROP POLICY IF EXISTS "jf_update_staff" ON public.justificativas_faltas;
CREATE POLICY "jf_update_staff" ON public.justificativas_faltas
  FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(auth.uid())
    OR public.is_professor_do_aluno(auth.uid(), aluno_id)
  )
  WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_jf_updated ON public.justificativas_faltas;
CREATE TRIGGER trg_jf_updated BEFORE UPDATE ON public.justificativas_faltas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_jf_aluno ON public.justificativas_faltas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_jf_status ON public.justificativas_faltas(status);

-- Bucket para anexos (atestados)
INSERT INTO storage.buckets (id, name, public)
VALUES ('justificativas', 'justificativas', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "jf_bucket_read_own" ON storage.objects;
CREATE POLICY "jf_bucket_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'justificativas'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_school_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "jf_bucket_write_own" ON storage.objects;
CREATE POLICY "jf_bucket_write_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'justificativas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ #7 MENSAGENS COORDENAÇÃO ============
CREATE TABLE IF NOT EXISTS public.mensagens_coordenacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL DEFAULT gen_random_uuid(),
  remetente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remetente_nome text NOT NULL,
  remetente_tipo text NOT NULL CHECK (remetente_tipo IN ('responsavel','coordenacao')),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  assunto text NOT NULL,
  mensagem text NOT NULL,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mensagens_coordenacao TO authenticated;
GRANT ALL ON public.mensagens_coordenacao TO service_role;
ALTER TABLE public.mensagens_coordenacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mc_select" ON public.mensagens_coordenacao;
CREATE POLICY "mc_select" ON public.mensagens_coordenacao
  FOR SELECT TO authenticated
  USING (
    remetente_id = auth.uid()
    OR public.is_school_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mensagens_coordenacao m2
      WHERE m2.thread_id = mensagens_coordenacao.thread_id
        AND m2.remetente_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mc_insert_resp" ON public.mensagens_coordenacao;
CREATE POLICY "mc_insert_resp" ON public.mensagens_coordenacao
  FOR INSERT TO authenticated
  WITH CHECK (
    remetente_id = auth.uid()
    AND (
      (remetente_tipo = 'responsavel')
      OR (remetente_tipo = 'coordenacao' AND public.is_school_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "mc_update_lida" ON public.mensagens_coordenacao;
CREATE POLICY "mc_update_lida" ON public.mensagens_coordenacao
  FOR UPDATE TO authenticated
  USING (
    remetente_id = auth.uid()
    OR public.is_school_admin(auth.uid())
  )
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mc_thread ON public.mensagens_coordenacao(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mc_remetente ON public.mensagens_coordenacao(remetente_id);

-- Push automático quando responsável envia mensagem
CREATE OR REPLACE FUNCTION public.tg_mensagem_coord_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.remetente_tipo = 'responsavel' THEN
    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
    VALUES (
      'Nova mensagem de responsável',
      COALESCE(NEW.remetente_nome, 'Responsável') || ': ' || LEFT(NEW.assunto, 120),
      '/painel-mensagens',
      'mensagem_coord',
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mc_push ON public.mensagens_coordenacao;
CREATE TRIGGER trg_mc_push AFTER INSERT ON public.mensagens_coordenacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_mensagem_coord_push();
