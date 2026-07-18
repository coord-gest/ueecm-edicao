
-- Enum de tipos de notificação
DO $$ BEGIN
  CREATE TYPE public.notificacao_tipo AS ENUM (
    'comunicado', 'alerta', 'agendamento', 'nota', 'frequencia', 'comentario', 'evento', 'sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.notificacoes_inapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo public.notificacao_tipo NOT NULL DEFAULT 'sistema',
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  icone TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  arquivada BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_inapp_user_created ON public.notificacoes_inapp (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_inapp_user_lida ON public.notificacoes_inapp (user_id, lida) WHERE arquivada = false;
CREATE INDEX IF NOT EXISTS idx_notif_inapp_tipo ON public.notificacoes_inapp (user_id, tipo);

-- Grants
GRANT SELECT, UPDATE, DELETE ON public.notificacoes_inapp TO authenticated;
GRANT ALL ON public.notificacoes_inapp TO service_role;

-- RLS
ALTER TABLE public.notificacoes_inapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas notificações"
  ON public.notificacoes_inapp FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza suas notificações"
  ON public.notificacoes_inapp FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário exclui suas notificações"
  ON public.notificacoes_inapp FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role gerencia notificações"
  ON public.notificacoes_inapp FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Trigger: quando algo entra em push_notifications_queue, replica em notificacoes_inapp
CREATE OR REPLACE FUNCTION public.fn_replicar_push_para_inapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.notificacao_tipo := 'sistema';
  v_meta_tipo TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_meta_tipo := COALESCE(NEW.payload->>'tipo', NEW.payload->>'type', 'sistema');

  BEGIN
    v_tipo := v_meta_tipo::public.notificacao_tipo;
  EXCEPTION WHEN OTHERS THEN
    v_tipo := 'sistema';
  END;

  INSERT INTO public.notificacoes_inapp (user_id, tipo, titulo, mensagem, link, metadata)
  VALUES (
    NEW.user_id,
    v_tipo,
    COALESCE(NEW.payload->>'title', NEW.payload->>'titulo', 'Notificação'),
    COALESCE(NEW.payload->>'body', NEW.payload->>'mensagem', NEW.payload->>'message'),
    COALESCE(NEW.payload->>'url', NEW.payload->>'link', NEW.payload->>'click_action'),
    COALESCE(NEW.payload, '{}'::jsonb)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_queue_para_inapp ON public.push_notifications_queue;
CREATE TRIGGER trg_push_queue_para_inapp
  AFTER INSERT ON public.push_notifications_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_replicar_push_para_inapp();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_inapp;
