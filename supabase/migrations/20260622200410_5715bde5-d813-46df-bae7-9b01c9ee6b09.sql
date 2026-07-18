
REVOKE SELECT (email, telefone) ON public.profissionais FROM anon;
GRANT SELECT (email, telefone) ON public.profissionais TO authenticated;

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar FAQ" ON public.developer_faq;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar FAQ" ON public.developer_faq;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir FAQ" ON public.developer_faq;
CREATE POLICY "Desenvolvedor pode inserir FAQ" ON public.developer_faq
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Desenvolvedor pode atualizar FAQ" ON public.developer_faq
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Desenvolvedor pode deletar FAQ" ON public.developer_faq
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));

DROP POLICY IF EXISTS "Usuários autenticados podem editar o perfil do dev" ON public.developer_profile;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir o perfil do dev" ON public.developer_profile;
CREATE POLICY "Desenvolvedor pode inserir perfil" ON public.developer_profile
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Desenvolvedor pode atualizar perfil" ON public.developer_profile
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));

DROP POLICY IF EXISTS "staff can read conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "staff can delete conversation" ON public.chat_conversations;
CREATE POLICY "Owner reads own conversation" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "Desenvolvedor reads all conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Owner deletes own conversation" ON public.chat_conversations
  FOR DELETE TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "Desenvolvedor deletes conversations" ON public.chat_conversations
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));

DROP POLICY IF EXISTS "staff can read message" ON public.chat_messages;
DROP POLICY IF EXISTS "staff can delete message" ON public.chat_messages;
CREATE POLICY "Owner reads own messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id IS NOT NULL
      AND c.user_id = auth.uid()
  ));
CREATE POLICY "Desenvolvedor reads all messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Owner deletes own messages" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id IS NOT NULL
      AND c.user_id = auth.uid()
  ));
CREATE POLICY "Desenvolvedor deletes messages" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
