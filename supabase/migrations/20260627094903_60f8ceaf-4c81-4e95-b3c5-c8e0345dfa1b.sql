CREATE POLICY "Owner inserts own messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.user_id IS NOT NULL
      AND c.user_id = auth.uid()
  )
);