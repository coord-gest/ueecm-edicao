-- Helper: monta chave padronizada para rate limit
CREATE OR REPLACE FUNCTION public.rl_key(_scope TEXT, _subject TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _scope || ':' || COALESCE(NULLIF(_subject, ''), 'anon');
$$;

REVOKE ALL ON FUNCTION public.rl_key(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rl_key(TEXT, TEXT) TO service_role, authenticated, anon;

-- ============================================================
-- 1) post_comentarios — 10 / 10min por user_id ou IP
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_post_comentarios_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject TEXT;
  v_ok BOOLEAN;
BEGIN
  -- Admin/staff isento
  IF auth.uid() IS NOT NULL AND public.is_professor_or_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_subject := COALESCE(NEW.user_id::text, NEW.ip_hash, 'anon');
  v_ok := public.check_rate_limit(
    public.rl_key('post_comentarios', v_subject),
    10,   -- máx
    600   -- janela: 10 min
  );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Você enviou muitos comentários recentemente. Aguarde alguns minutos e tente novamente.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_post_comentarios_rate_limit ON public.post_comentarios;
CREATE TRIGGER tg_post_comentarios_rate_limit
  BEFORE INSERT ON public.post_comentarios
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_post_comentarios_rate_limit();

-- ============================================================
-- 2) enquete_respostas — 30 / min por user_id ou ip_hash
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_enquete_respostas_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject TEXT;
  v_ok BOOLEAN;
BEGIN
  v_subject := COALESCE(NEW.user_id::text, NEW.ip_hash, 'anon');
  v_ok := public.check_rate_limit(
    public.rl_key('enquete_respostas', v_subject),
    30,
    60
  );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Muitas respostas em pouco tempo. Aguarde antes de votar novamente.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_enquete_respostas_rate_limit ON public.enquete_respostas;
CREATE TRIGGER tg_enquete_respostas_rate_limit
  BEFORE INSERT ON public.enquete_respostas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enquete_respostas_rate_limit();

-- ============================================================
-- 3) mensagens_coordenacao — 5 / hora por remetente
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_mensagens_coord_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject TEXT;
  v_ok BOOLEAN;
BEGIN
  -- Só limita quando o remetente é responsável (público). Staff/admin isento.
  IF NEW.remetente_tipo IS DISTINCT FROM 'responsavel' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.is_school_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_subject := COALESCE(
    (NEW.remetente_id)::text,
    NEW.remetente_email,
    'anon'
  );
  v_ok := public.check_rate_limit(
    public.rl_key('mensagens_coord', v_subject),
    5,
    3600
  );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Você já enviou várias mensagens à coordenação nesta hora. Aguarde antes de enviar outra.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_mensagens_coord_rate_limit ON public.mensagens_coordenacao;
CREATE TRIGGER tg_mensagens_coord_rate_limit
  BEFORE INSERT ON public.mensagens_coordenacao
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_mensagens_coord_rate_limit();

-- ============================================================
-- 4) chat_alunos_mensagens — 30 / min por autor (anti-flood)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_chat_alunos_msg_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF NEW.autor_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_ok := public.check_rate_limit(
    public.rl_key('chat_alunos_msg', NEW.autor_user_id::text),
    30,
    60
  );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Muitas mensagens em pouco tempo. Aguarde alguns segundos.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_chat_alunos_msg_rate_limit ON public.chat_alunos_mensagens;
-- IMPORTANTE: precisa disparar ANTES do tg_chat_alunos_msg_after_insert (AFTER), então BEFORE INSERT é OK.
CREATE TRIGGER tg_chat_alunos_msg_rate_limit
  BEFORE INSERT ON public.chat_alunos_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_chat_alunos_msg_rate_limit();