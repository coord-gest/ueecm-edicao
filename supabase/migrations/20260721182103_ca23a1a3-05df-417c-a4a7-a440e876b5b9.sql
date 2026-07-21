
DO $$ BEGIN
  CREATE TYPE public.contrato_status AS ENUM ('rascunho','aguardando_assinaturas','ativo','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.checkpoint_status AS ENUM ('cumprido','parcial','nao_cumprido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contratos_compromisso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  autor_id uuid NOT NULL,
  titulo text NOT NULL,
  motivo text,
  objetivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  prazo date,
  status public.contrato_status NOT NULL DEFAULT 'rascunho',
  assinado_professor_em timestamptz,
  assinado_responsavel_id uuid,
  assinado_responsavel_em timestamptz,
  assinado_aluno_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_aluno ON public.contratos_compromisso(aluno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_turma ON public.contratos_compromisso(turma_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_autor ON public.contratos_compromisso(autor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos_compromisso(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_compromisso TO authenticated;
GRANT ALL ON public.contratos_compromisso TO service_role;

ALTER TABLE public.contratos_compromisso ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratos_read_professor ON public.contratos_compromisso
  FOR SELECT TO authenticated
  USING (public.is_professor_do_aluno(auth.uid(), aluno_id) OR public.is_school_admin(auth.uid()));

CREATE POLICY contratos_read_responsavel ON public.contratos_compromisso
  FOR SELECT TO authenticated
  USING (public.is_responsavel_do_aluno(auth.uid(), aluno_id));

CREATE POLICY contratos_insert_autor ON public.contratos_compromisso
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (public.is_professor_do_aluno(auth.uid(), aluno_id) OR public.is_school_admin(auth.uid()))
  );

CREATE POLICY contratos_update_autor ON public.contratos_compromisso
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()))
  WITH CHECK (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE POLICY contratos_update_responsavel ON public.contratos_compromisso
  FOR UPDATE TO authenticated
  USING (public.is_responsavel_do_aluno(auth.uid(), aluno_id))
  WITH CHECK (public.is_responsavel_do_aluno(auth.uid(), aluno_id));

CREATE POLICY contratos_delete_autor ON public.contratos_compromisso
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON public.contratos_compromisso
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.contrato_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos_compromisso(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status public.checkpoint_status NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_contrato ON public.contrato_checkpoints(contrato_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_checkpoints TO authenticated;
GRANT ALL ON public.contrato_checkpoints TO service_role;

ALTER TABLE public.contrato_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkpoints_read ON public.contrato_checkpoints
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.contratos_compromisso c
    WHERE c.id = contrato_id
      AND (
        public.is_professor_do_aluno(auth.uid(), c.aluno_id)
        OR public.is_school_admin(auth.uid())
        OR public.is_responsavel_do_aluno(auth.uid(), c.aluno_id)
      )
  ));

CREATE POLICY checkpoints_insert ON public.contrato_checkpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.contratos_compromisso c
      WHERE c.id = contrato_id
        AND (public.is_professor_do_aluno(auth.uid(), c.aluno_id) OR public.is_school_admin(auth.uid()))
    )
  );

CREATE POLICY checkpoints_update_autor ON public.contrato_checkpoints
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE POLICY checkpoints_delete_autor ON public.contrato_checkpoints
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_school_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.assinar_contrato_responsavel(_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid;
  v_status contrato_status;
BEGIN
  SELECT aluno_id, status INTO v_aluno, v_status
  FROM public.contratos_compromisso WHERE id = _contrato_id;

  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF NOT public.is_responsavel_do_aluno(v_uid, v_aluno) THEN
    RAISE EXCEPTION 'Sem permissão para assinar este contrato';
  END IF;
  IF v_status IN ('cancelado','concluido') THEN
    RAISE EXCEPTION 'Contrato já foi encerrado';
  END IF;

  UPDATE public.contratos_compromisso
  SET assinado_responsavel_id = v_uid,
      assinado_responsavel_em = now(),
      status = CASE
        WHEN assinado_professor_em IS NOT NULL THEN 'ativo'::contrato_status
        ELSE 'aguardando_assinaturas'::contrato_status
      END
  WHERE id = _contrato_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assinar_contrato_responsavel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_responsavel(uuid) TO authenticated;
