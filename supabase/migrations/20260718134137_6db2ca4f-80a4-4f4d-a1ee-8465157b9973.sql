-- ============================================================
-- Fase 1 (Médio Impacto): Sistema de Enquetes/Pesquisas
-- ============================================================

-- Tipos
DO $$ BEGIN
  CREATE TYPE public.enquete_tipo AS ENUM ('unica','multipla');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enquete_publico AS ENUM ('todos','autenticados','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.enquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo public.enquete_tipo NOT NULL DEFAULT 'unica',
  publico public.enquete_publico NOT NULL DEFAULT 'todos',
  permite_anonimo BOOLEAN NOT NULL DEFAULT true,
  mostrar_resultados_antes BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  encerra_em TIMESTAMPTZ,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.enquetes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.enquetes TO authenticated;
GRANT ALL ON public.enquetes TO service_role;

ALTER TABLE public.enquetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enquetes_select_publico"
  ON public.enquetes FOR SELECT
  USING (
    ativo = true
    OR public.is_school_admin(auth.uid())
    OR criado_por = auth.uid()
  );

CREATE POLICY "enquetes_admin_manage"
  ON public.enquetes FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

CREATE TRIGGER trg_enquetes_updated_at
  BEFORE UPDATE ON public.enquetes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Opções
CREATE TABLE IF NOT EXISTS public.enquete_opcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquete_id UUID NOT NULL REFERENCES public.enquetes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquete_opcoes_enquete ON public.enquete_opcoes(enquete_id, ordem);

GRANT SELECT ON public.enquete_opcoes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.enquete_opcoes TO authenticated;
GRANT ALL ON public.enquete_opcoes TO service_role;

ALTER TABLE public.enquete_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enquete_opcoes_select"
  ON public.enquete_opcoes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.enquetes e WHERE e.id = enquete_id
            AND (e.ativo = true OR public.is_school_admin(auth.uid()) OR e.criado_por = auth.uid()))
  );

CREATE POLICY "enquete_opcoes_admin_manage"
  ON public.enquete_opcoes FOR ALL TO authenticated
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

-- Respostas
CREATE TABLE IF NOT EXISTS public.enquete_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquete_id UUID NOT NULL REFERENCES public.enquetes(id) ON DELETE CASCADE,
  opcao_id UUID NOT NULL REFERENCES public.enquete_opcoes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquete_respostas_enquete ON public.enquete_respostas(enquete_id);
CREATE INDEX IF NOT EXISTS idx_enquete_respostas_user ON public.enquete_respostas(user_id) WHERE user_id IS NOT NULL;

-- Unicidade por usuário identificado (uma resposta por opção; múltipla escolha permite várias opções distintas)
CREATE UNIQUE INDEX IF NOT EXISTS uq_enquete_respostas_user_opcao
  ON public.enquete_respostas(enquete_id, user_id, opcao_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_enquete_respostas_ip_opcao
  ON public.enquete_respostas(enquete_id, ip_hash, opcao_id)
  WHERE user_id IS NULL AND ip_hash IS NOT NULL;

GRANT SELECT, INSERT ON public.enquete_respostas TO anon, authenticated;
GRANT ALL ON public.enquete_respostas TO service_role;

ALTER TABLE public.enquete_respostas ENABLE ROW LEVEL SECURITY;

-- Trigger de validação: bloqueia votos em enquetes inativas/encerradas e valida público-alvo + tipo (única vs múltipla)
CREATE OR REPLACE FUNCTION public.tg_enquete_respostas_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enq public.enquetes;
  v_existentes int;
BEGIN
  SELECT * INTO v_enq FROM public.enquetes WHERE id = NEW.enquete_id;
  IF v_enq IS NULL THEN
    RAISE EXCEPTION 'Enquete inexistente';
  END IF;
  IF v_enq.ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Enquete inativa';
  END IF;
  IF v_enq.encerra_em IS NOT NULL AND v_enq.encerra_em < now() THEN
    RAISE EXCEPTION 'Enquete encerrada';
  END IF;

  -- Público alvo
  IF v_enq.publico = 'autenticados' AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'É necessário estar autenticado para responder';
  END IF;
  IF v_enq.publico = 'staff' AND (NEW.user_id IS NULL OR NOT public.is_professor_or_staff(NEW.user_id)) THEN
    RAISE EXCEPTION 'Apenas equipe autorizada pode responder';
  END IF;
  IF v_enq.permite_anonimo IS NOT TRUE AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Esta enquete não aceita votos anônimos';
  END IF;

  -- Tipo única: bloquear se já votou
  IF v_enq.tipo = 'unica' THEN
    IF NEW.user_id IS NOT NULL THEN
      SELECT count(*) INTO v_existentes FROM public.enquete_respostas
        WHERE enquete_id = NEW.enquete_id AND user_id = NEW.user_id;
      IF v_existentes >= 1 THEN
        RAISE EXCEPTION 'Você já votou nesta enquete';
      END IF;
    ELSIF NEW.ip_hash IS NOT NULL THEN
      SELECT count(*) INTO v_existentes FROM public.enquete_respostas
        WHERE enquete_id = NEW.enquete_id AND ip_hash = NEW.ip_hash;
      IF v_existentes >= 1 THEN
        RAISE EXCEPTION 'Voto já registrado';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enquete_respostas_validate
  BEFORE INSERT ON public.enquete_respostas
  FOR EACH ROW EXECUTE FUNCTION public.tg_enquete_respostas_validate();

CREATE POLICY "enquete_respostas_insert_publico"
  ON public.enquete_respostas FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "enquete_respostas_select_owner_or_admin"
  ON public.enquete_respostas FOR SELECT
  USING (
    public.is_school_admin(auth.uid())
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- View pública com contagem agregada (sem expor voto individual)
CREATE OR REPLACE VIEW public.enquete_resultados
WITH (security_invoker = off)
AS
  SELECT
    o.enquete_id,
    o.id AS opcao_id,
    o.texto,
    o.ordem,
    COUNT(r.id)::int AS votos
  FROM public.enquete_opcoes o
  LEFT JOIN public.enquete_respostas r ON r.opcao_id = o.id
  GROUP BY o.enquete_id, o.id, o.texto, o.ordem;

GRANT SELECT ON public.enquete_resultados TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquete_respostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquetes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enquete_opcoes;