-- Tipos
CREATE TYPE public.dsr_type AS ENUM (
  'acesso',
  'correcao',
  'exclusao',
  'portabilidade',
  'oposicao',
  'anonimizacao',
  'informacao'
);

CREATE TYPE public.dsr_status AS ENUM (
  'pendente',
  'em_analise',
  'concluida',
  'rejeitada'
);

-- Sequência para protocolo legível (DSR-2026-000001)
CREATE SEQUENCE IF NOT EXISTS public.dsr_protocolo_seq;

CREATE OR REPLACE FUNCTION public.gerar_protocolo_dsr()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'DSR-' || to_char((now() AT TIME ZONE 'America/Fortaleza'), 'YYYY')
    || '-' || lpad(nextval('public.dsr_protocolo_seq')::text, 6, '0');
$$;

-- 1. CREATE TABLE
CREATE TABLE public.data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE DEFAULT public.gerar_protocolo_dsr(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome TEXT NOT NULL CHECK (length(trim(solicitante_nome)) BETWEEN 2 AND 200),
  solicitante_email TEXT NOT NULL CHECK (length(trim(solicitante_email)) BETWEEN 3 AND 255),
  solicitante_cpf TEXT,
  solicitante_telefone TEXT,
  tipo public.dsr_type NOT NULL,
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) BETWEEN 10 AND 2000),
  status public.dsr_status NOT NULL DEFAULT 'pendente',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. GRANTS (obrigatório — public schema não tem grants default)
GRANT SELECT, INSERT ON public.data_subject_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.data_subject_requests TO authenticated;
GRANT ALL ON public.data_subject_requests TO service_role;
GRANT USAGE ON SEQUENCE public.dsr_protocolo_seq TO anon, authenticated, service_role;

-- 3. ENABLE RLS
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
-- INSERT aberto — LGPD Art. 18 exige canal acessível inclusive a anônimos
CREATE POLICY "Anyone can submit a data subject request"
ON public.data_subject_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Titular autenticado vê as próprias solicitações
CREATE POLICY "Users can see their own requests"
ON public.data_subject_requests
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- Admins escolares veem todas
CREATE POLICY "School admins can see all requests"
ON public.data_subject_requests
FOR SELECT
TO authenticated
USING (public.is_school_admin(auth.uid()));

-- Apenas admins atualizam (status, notas, resolução)
CREATE POLICY "School admins can update requests"
ON public.data_subject_requests
FOR UPDATE
TO authenticated
USING (public.is_school_admin(auth.uid()))
WITH CHECK (public.is_school_admin(auth.uid()));

-- Índices para painel admin
CREATE INDEX idx_dsr_status ON public.data_subject_requests(status);
CREATE INDEX idx_dsr_user_id ON public.data_subject_requests(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_dsr_created_at ON public.data_subject_requests(created_at DESC);
CREATE INDEX idx_dsr_tipo ON public.data_subject_requests(tipo);

-- Trigger updated_at
CREATE TRIGGER trg_dsr_updated_at
BEFORE UPDATE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger de auditoria (reutiliza a infra existente)
CREATE TRIGGER trg_dsr_audit
AFTER INSERT OR UPDATE OR DELETE ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- Push automático para admins quando nova solicitação chegar
CREATE OR REPLACE FUNCTION public.tg_dsr_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_label text;
BEGIN
  v_tipo_label := CASE NEW.tipo
    WHEN 'acesso' THEN 'Acesso aos dados'
    WHEN 'correcao' THEN 'Correção de dados'
    WHEN 'exclusao' THEN 'Exclusão de dados'
    WHEN 'portabilidade' THEN 'Portabilidade'
    WHEN 'oposicao' THEN 'Oposição ao tratamento'
    WHEN 'anonimizacao' THEN 'Anonimização'
    WHEN 'informacao' THEN 'Informação sobre uso'
    ELSE NEW.tipo::text
  END;

  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
  VALUES (
    'Nova solicitação LGPD (' || NEW.protocolo || ')',
    v_tipo_label || ' — ' || COALESCE(NEW.solicitante_nome, 'Titular') || ': ' || LEFT(COALESCE(NEW.descricao, ''), 180),
    '/painel-lgpd',
    'dsr',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dsr_notify
AFTER INSERT ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_dsr_enqueue_push();

-- Rate limit: no máximo 5 solicitações por e-mail a cada 10 minutos
-- (protege contra flood via canal público)
CREATE OR REPLACE FUNCTION public.tg_dsr_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Admins autenticados ficam isentos
  IF auth.uid() IS NOT NULL AND public.is_school_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.data_subject_requests
  WHERE lower(solicitante_email) = lower(NEW.solicitante_email)
    AND created_at > now() - interval '10 minutes';

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'Muitas solicitações enviadas deste e-mail nos últimos minutos. Aguarde antes de enviar outra.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dsr_rate_limit
BEFORE INSERT ON public.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_dsr_rate_limit();