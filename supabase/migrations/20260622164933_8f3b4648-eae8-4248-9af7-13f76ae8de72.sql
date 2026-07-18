
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_conversations_session ON public.chat_conversations(session_id);
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO anon, authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversas: qualquer um pode criar; leitura/edição livre (sessão identificada via session_id no app); staff pode tudo
CREATE POLICY "anyone can insert conversation" ON public.chat_conversations
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone can read conversation" ON public.chat_conversations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone can update conversation" ON public.chat_conversations
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff can delete conversation" ON public.chat_conversations
  FOR DELETE TO authenticated USING (public.is_school_staff(auth.uid()));

-- Mensagens: insert/select livre (escopadas no app pelo conversation_id); staff pode deletar
CREATE POLICY "anyone can insert message" ON public.chat_messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone can read message" ON public.chat_messages
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff can delete message" ON public.chat_messages
  FOR DELETE TO authenticated USING (public.is_school_staff(auth.uid()));

CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
