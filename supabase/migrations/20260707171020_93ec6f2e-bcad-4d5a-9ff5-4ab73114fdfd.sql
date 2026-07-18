-- Nova tabela para tokens FCM (Firebase Cloud Messaging).
-- Substitui push_subscriptions no fluxo de notificações. A tabela antiga
-- fica intocada até confirmarmos que o FCM funciona; será removida em
-- migração separada.

CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

-- Grants: autenticados gerenciam os próprios; service_role acessa tudo
-- (usado pelo dispatcher no servidor). Não damos acesso ao anon: inscrição
-- e remoção passam por rotas HTTP no servidor com admin client.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam seus próprios tokens FCM"
  ON public.fcm_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at (reusa função existente)
CREATE TRIGGER fcm_tokens_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_updated_at();
