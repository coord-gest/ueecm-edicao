-- ============================================================================
-- Famílias UEECM — Depoimentos com moderação
-- Execute este SQL no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/mhmdjjbqbbsgcsjujuhx/sql/new
-- ============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.familia_dep_tipo AS ENUM ('comentario', 'sugestao', 'elogio');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.familia_dep_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.familia_dep_vinculo AS ENUM
    ('mae','pai','responsavel','aluno','professor','ex_aluno','comunidade');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Tabela ----------
CREATE TABLE IF NOT EXISTS public.familias_depoimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem        text NOT NULL,
  tipo            public.familia_dep_tipo NOT NULL DEFAULT 'comentario',
  autor_nome      text,
  autor_idade     int,
  vinculo         public.familia_dep_vinculo NOT NULL DEFAULT 'comunidade',
  turma_ano       text,
  email_contato   text,
  status          public.familia_dep_status NOT NULL DEFAULT 'pendente',
  moderado_por    uuid,
  moderado_em     timestamptz,
  motivo_rejeicao text,
  submitted_by    uuid,
  ip_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT familias_depoimentos_msg_len CHECK (char_length(mensagem) BETWEEN 20 AND 800),
  CONSTRAINT familias_depoimentos_idade_ok CHECK (autor_idade IS NULL OR (autor_idade BETWEEN 3 AND 120))
);

CREATE INDEX IF NOT EXISTS idx_familias_depoimentos_status_created
  ON public.familias_depoimentos (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_familias_depoimentos_ip_recent
  ON public.familias_depoimentos (ip_hash, created_at DESC);

-- ---------- GRANTs (Data API) ----------
GRANT SELECT, INSERT ON public.familias_depoimentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.familias_depoimentos TO authenticated;
GRANT ALL ON public.familias_depoimentos TO service_role;

-- ---------- Trigger: força status inicial pendente + rate-limit por IP ----------
CREATE OR REPLACE FUNCTION public.tg_familias_depoimentos_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Cliente NUNCA define status ou campos de moderação
  NEW.status := 'pendente';
  NEW.moderado_por := NULL;
  NEW.moderado_em := NULL;
  NEW.motivo_rejeicao := NULL;

  -- Rate-limit leve por ip_hash (máx 3 envios/hora)
  IF NEW.ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.familias_depoimentos
    WHERE ip_hash = NEW.ip_hash
      AND created_at > now() - interval '1 hour';
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Muitos envios recentes. Aguarde alguns minutos antes de enviar outro depoimento.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_familias_depoimentos_before_insert ON public.familias_depoimentos;
CREATE TRIGGER tg_familias_depoimentos_before_insert
  BEFORE INSERT ON public.familias_depoimentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_familias_depoimentos_before_insert();

-- ---------- Trigger updated_at ----------
DROP TRIGGER IF EXISTS tg_familias_depoimentos_updated_at ON public.familias_depoimentos;
CREATE TRIGGER tg_familias_depoimentos_updated_at
  BEFORE UPDATE ON public.familias_depoimentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- RLS ----------
ALTER TABLE public.familias_depoimentos ENABLE ROW LEVEL SECURITY;

-- INSERT: qualquer visitante (anon) ou usuário autenticado pode enviar
DROP POLICY IF EXISTS "familias_dep_insert_anyone" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_insert_anyone"
  ON public.familias_depoimentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT público: apenas aprovados
DROP POLICY IF EXISTS "familias_dep_select_aprovados" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_select_aprovados"
  ON public.familias_depoimentos
  FOR SELECT
  TO anon, authenticated
  USING (status = 'aprovado');

-- SELECT/UPDATE/DELETE completo: apenas staff de moderação
DROP POLICY IF EXISTS "familias_dep_select_staff" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_select_staff"
  ON public.familias_depoimentos
  FOR SELECT
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS "familias_dep_update_staff" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_update_staff"
  ON public.familias_depoimentos
  FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS "familias_dep_delete_staff" ON public.familias_depoimentos;
CREATE POLICY "familias_dep_delete_staff"
  ON public.familias_depoimentos
  FOR DELETE
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

-- ---------- View pública (colunas seguras) ----------
DROP VIEW IF EXISTS public.familias_depoimentos_publicos;
CREATE VIEW public.familias_depoimentos_publicos
WITH (security_invoker = on)
AS
SELECT
  id,
  mensagem,
  tipo,
  autor_nome,
  autor_idade,
  vinculo,
  turma_ano,
  created_at
FROM public.familias_depoimentos
WHERE status = 'aprovado';

GRANT SELECT ON public.familias_depoimentos_publicos TO anon, authenticated;

-- ============================================================================
-- Pronto! Após executar, o sistema poderá receber e moderar depoimentos.
-- ============================================================================
