
CREATE TABLE IF NOT EXISTS public.chat_alunos_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  responsavel_user_id UUID NOT NULL,
  professor_user_id UUID NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, responsavel_user_id, professor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_alunos_threads_resp ON public.chat_alunos_threads(responsavel_user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_alunos_threads_prof ON public.chat_alunos_threads(professor_user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_chat_alunos_threads_aluno ON public.chat_alunos_threads(aluno_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_alunos_threads TO authenticated;
GRANT ALL ON public.chat_alunos_threads TO service_role;

ALTER TABLE public.chat_alunos_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem suas threads"
  ON public.chat_alunos_threads FOR SELECT TO authenticated
  USING (
    auth.uid() = responsavel_user_id
    OR auth.uid() = professor_user_id
    OR public.is_school_admin(auth.uid())
  );

CREATE POLICY "Participantes criam thread"
  ON public.chat_alunos_threads FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = responsavel_user_id AND public.is_responsavel_do_aluno(auth.uid(), aluno_id))
    OR (auth.uid() = professor_user_id AND public.is_professor_do_aluno(auth.uid(), aluno_id))
    OR public.is_school_admin(auth.uid())
  );

CREATE POLICY "Participantes atualizam thread"
  ON public.chat_alunos_threads FOR UPDATE TO authenticated
  USING (
    auth.uid() = responsavel_user_id
    OR auth.uid() = professor_user_id
    OR public.is_school_admin(auth.uid())
  );

CREATE TRIGGER trg_chat_alunos_threads_updated_at
  BEFORE UPDATE ON public.chat_alunos_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_alunos_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.chat_alunos_threads(id) ON DELETE CASCADE,
  autor_user_id UUID NOT NULL,
  autor_tipo TEXT NOT NULL CHECK (autor_tipo IN ('responsavel','professor')),
  conteudo TEXT NOT NULL CHECK (length(trim(conteudo)) > 0 AND length(conteudo) <= 4000),
  anexo_url TEXT,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_alunos_mensagens_thread ON public.chat_alunos_mensagens(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.chat_alunos_mensagens TO authenticated;
GRANT ALL ON public.chat_alunos_mensagens TO service_role;

ALTER TABLE public.chat_alunos_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem mensagens"
  ON public.chat_alunos_mensagens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_alunos_threads t
      WHERE t.id = thread_id
        AND (auth.uid() = t.responsavel_user_id OR auth.uid() = t.professor_user_id OR public.is_school_admin(auth.uid()))
    )
  );

CREATE POLICY "Participantes enviam mensagem"
  ON public.chat_alunos_mensagens FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = autor_user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_alunos_threads t
      WHERE t.id = thread_id
        AND (
          (autor_tipo = 'responsavel' AND auth.uid() = t.responsavel_user_id)
          OR (autor_tipo = 'professor' AND auth.uid() = t.professor_user_id)
        )
    )
  );

CREATE POLICY "Destinatario marca leitura"
  ON public.chat_alunos_mensagens FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_alunos_threads t
      WHERE t.id = thread_id
        AND (auth.uid() = t.responsavel_user_id OR auth.uid() = t.professor_user_id)
        AND auth.uid() <> autor_user_id
    )
  );

ALTER TABLE public.chat_alunos_threads REPLICA IDENTITY FULL;
ALTER TABLE public.chat_alunos_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_alunos_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_alunos_mensagens;

CREATE OR REPLACE FUNCTION public.tg_chat_alunos_msg_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.chat_alunos_threads;
  v_dest_user_id UUID;
  v_aluno_nome TEXT;
  v_autor_nome TEXT;
BEGIN
  SELECT * INTO v_thread FROM public.chat_alunos_threads WHERE id = NEW.thread_id;
  IF v_thread IS NULL THEN RETURN NEW; END IF;

  UPDATE public.chat_alunos_threads
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.conteudo, 160),
        updated_at = now()
    WHERE id = NEW.thread_id;

  v_dest_user_id := CASE
    WHEN NEW.autor_user_id = v_thread.responsavel_user_id THEN v_thread.professor_user_id
    ELSE v_thread.responsavel_user_id
  END;

  SELECT nome_completo INTO v_aluno_nome FROM public.alunos WHERE id = v_thread.aluno_id;
  SELECT COALESCE(display_name, email) INTO v_autor_nome FROM public.profiles WHERE user_id = NEW.autor_user_id;

  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id, user_id)
  VALUES (
    'Nova mensagem — ' || COALESCE(v_aluno_nome, 'aluno'),
    COALESCE(v_autor_nome, 'Nova mensagem') || ': ' || LEFT(NEW.conteudo, 180),
    '/chat-aluno/' || v_thread.id::text,
    'chat_aluno',
    NEW.id,
    v_dest_user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_alunos_msg_after_insert ON public.chat_alunos_mensagens;
CREATE TRIGGER trg_chat_alunos_msg_after_insert
  AFTER INSERT ON public.chat_alunos_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.tg_chat_alunos_msg_after_insert();

CREATE POLICY "Participantes leem anexos do chat"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-alunos-anexos'
    AND EXISTS (
      SELECT 1 FROM public.chat_alunos_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.responsavel_user_id OR auth.uid() = t.professor_user_id OR public.is_school_admin(auth.uid()))
    )
  );

CREATE POLICY "Participantes enviam anexos do chat"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-alunos-anexos'
    AND EXISTS (
      SELECT 1 FROM public.chat_alunos_threads t
      WHERE t.id::text = split_part(name, '/', 1)
        AND (auth.uid() = t.responsavel_user_id OR auth.uid() = t.professor_user_id)
    )
  );
