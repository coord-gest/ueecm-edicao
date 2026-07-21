
-- ============ REDE DE APOIO ============
CREATE TABLE public.rede_apoio_ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('transporte','reforco','material','alimentacao','vestuario','saude','outro')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  contato TEXT,
  bairro TEXT,
  disponibilidade TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','concluido','arquivado')),
  moderado_por UUID,
  moderado_em TIMESTAMPTZ,
  motivo_moderacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rede_apoio_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN ('transporte','reforco','material','alimentacao','vestuario','saude','outro')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  urgencia TEXT NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('baixa','normal','alta')),
  anonimo BOOLEAN NOT NULL DEFAULT true,
  contato_reserva TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','atendido','arquivado')),
  moderado_por UUID,
  moderado_em TIMESTAMPTZ,
  motivo_moderacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rede_apoio_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID REFERENCES public.rede_apoio_ofertas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.rede_apoio_pedidos(id) ON DELETE CASCADE,
  iniciado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','concluido','cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ VAQUINHA DIGITAL ============
CREATE TABLE public.vaquinhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  beneficiario TEXT NOT NULL,
  meta_centavos BIGINT NOT NULL CHECK (meta_centavos > 0),
  arrecadado_centavos BIGINT NOT NULL DEFAULT 0 CHECK (arrecadado_centavos >= 0),
  chave_pix TEXT,
  foto_url TEXT,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativa','pausada','concluida','cancelada')),
  destaque BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vaquinha_contribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaquinha_id UUID NOT NULL REFERENCES public.vaquinhas(id) ON DELETE CASCADE,
  contribuinte_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contribuinte_nome TEXT,
  valor_centavos BIGINT NOT NULL CHECK (valor_centavos > 0),
  mensagem TEXT,
  anonimo BOOLEAN NOT NULL DEFAULT false,
  comprovante_url TEXT,
  confirmado BOOLEAN NOT NULL DEFAULT false,
  confirmado_por UUID,
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_apoio_ofertas TO authenticated;
GRANT ALL ON public.rede_apoio_ofertas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_apoio_pedidos TO authenticated;
GRANT ALL ON public.rede_apoio_pedidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_apoio_matches TO authenticated;
GRANT ALL ON public.rede_apoio_matches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaquinhas TO authenticated;
GRANT ALL ON public.vaquinhas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaquinha_contribuicoes TO authenticated;
GRANT ALL ON public.vaquinha_contribuicoes TO service_role;

-- ============ RLS ============
ALTER TABLE public.rede_apoio_ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_apoio_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_apoio_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaquinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaquinha_contribuicoes ENABLE ROW LEVEL SECURITY;

-- Helper: is staff (admin/diretor/coordenador/secretario)
CREATE OR REPLACE FUNCTION public.is_apoio_staff(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('admin','diretor','coordenador','secretario')
  )
$$;

-- Ofertas policies
CREATE POLICY "ofertas_select_aprovadas_ou_proprias" ON public.rede_apoio_ofertas
  FOR SELECT TO authenticated
  USING (status = 'aprovado' OR autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));
CREATE POLICY "ofertas_insert_proprias" ON public.rede_apoio_ofertas
  FOR INSERT TO authenticated
  WITH CHECK (autor_user_id = auth.uid());
CREATE POLICY "ofertas_update_proprias_ou_staff" ON public.rede_apoio_ofertas
  FOR UPDATE TO authenticated
  USING (autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));
CREATE POLICY "ofertas_delete_proprias_ou_staff" ON public.rede_apoio_ofertas
  FOR DELETE TO authenticated
  USING (autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));

-- Pedidos policies
CREATE POLICY "pedidos_select_aprovados_ou_proprios" ON public.rede_apoio_pedidos
  FOR SELECT TO authenticated
  USING (status = 'aprovado' OR autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));
CREATE POLICY "pedidos_insert_proprios" ON public.rede_apoio_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (autor_user_id = auth.uid());
CREATE POLICY "pedidos_update_proprios_ou_staff" ON public.rede_apoio_pedidos
  FOR UPDATE TO authenticated
  USING (autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));
CREATE POLICY "pedidos_delete_proprios_ou_staff" ON public.rede_apoio_pedidos
  FOR DELETE TO authenticated
  USING (autor_user_id = auth.uid() OR public.is_apoio_staff(auth.uid()));

-- Matches policies (envolvidos ou staff)
CREATE POLICY "matches_select_envolvidos" ON public.rede_apoio_matches
  FOR SELECT TO authenticated
  USING (
    iniciado_por = auth.uid()
    OR public.is_apoio_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rede_apoio_ofertas o WHERE o.id = oferta_id AND o.autor_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.rede_apoio_pedidos p WHERE p.id = pedido_id AND p.autor_user_id = auth.uid())
  );
CREATE POLICY "matches_insert_autenticados" ON public.rede_apoio_matches
  FOR INSERT TO authenticated
  WITH CHECK (iniciado_por = auth.uid());
CREATE POLICY "matches_update_envolvidos" ON public.rede_apoio_matches
  FOR UPDATE TO authenticated
  USING (
    iniciado_por = auth.uid()
    OR public.is_apoio_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.rede_apoio_ofertas o WHERE o.id = oferta_id AND o.autor_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.rede_apoio_pedidos p WHERE p.id = pedido_id AND p.autor_user_id = auth.uid())
  );

-- Vaquinhas policies
CREATE POLICY "vaquinhas_select_ativas_ou_staff" ON public.vaquinhas
  FOR SELECT TO authenticated
  USING (status IN ('ativa','pausada','concluida') OR public.is_apoio_staff(auth.uid()));
CREATE POLICY "vaquinhas_insert_staff" ON public.vaquinhas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_apoio_staff(auth.uid()));
CREATE POLICY "vaquinhas_update_staff" ON public.vaquinhas
  FOR UPDATE TO authenticated
  USING (public.is_apoio_staff(auth.uid()));
CREATE POLICY "vaquinhas_delete_staff" ON public.vaquinhas
  FOR DELETE TO authenticated
  USING (public.is_apoio_staff(auth.uid()));

-- Contribuições policies
CREATE POLICY "contrib_select_autenticados" ON public.vaquinha_contribuicoes
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "contrib_insert_autenticados" ON public.vaquinha_contribuicoes
  FOR INSERT TO authenticated
  WITH CHECK (contribuinte_user_id = auth.uid() OR contribuinte_user_id IS NULL);
CREATE POLICY "contrib_update_staff" ON public.vaquinha_contribuicoes
  FOR UPDATE TO authenticated
  USING (public.is_apoio_staff(auth.uid()));
CREATE POLICY "contrib_delete_staff" ON public.vaquinha_contribuicoes
  FOR DELETE TO authenticated
  USING (public.is_apoio_staff(auth.uid()));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_rede_ofertas_updated BEFORE UPDATE ON public.rede_apoio_ofertas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_rede_pedidos_updated BEFORE UPDATE ON public.rede_apoio_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_rede_matches_updated BEFORE UPDATE ON public.rede_apoio_matches
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_vaquinhas_updated BEFORE UPDATE ON public.vaquinhas
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Recalcula arrecadado ao confirmar contribuição
CREATE OR REPLACE FUNCTION public.tg_vaquinha_recalc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  v_id := COALESCE(NEW.vaquinha_id, OLD.vaquinha_id);
  UPDATE public.vaquinhas
     SET arrecadado_centavos = COALESCE((
       SELECT SUM(valor_centavos) FROM public.vaquinha_contribuicoes
        WHERE vaquinha_id = v_id AND confirmado = true
     ), 0)
   WHERE id = v_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vaquinha_contrib_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.vaquinha_contribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_vaquinha_recalc();

-- Índices úteis
CREATE INDEX idx_ofertas_status ON public.rede_apoio_ofertas(status, created_at DESC);
CREATE INDEX idx_ofertas_autor ON public.rede_apoio_ofertas(autor_user_id);
CREATE INDEX idx_pedidos_status ON public.rede_apoio_pedidos(status, urgencia, created_at DESC);
CREATE INDEX idx_pedidos_autor ON public.rede_apoio_pedidos(autor_user_id);
CREATE INDEX idx_vaquinhas_status ON public.vaquinhas(status, destaque DESC, created_at DESC);
CREATE INDEX idx_contrib_vaquinha ON public.vaquinha_contribuicoes(vaquinha_id, created_at DESC);
