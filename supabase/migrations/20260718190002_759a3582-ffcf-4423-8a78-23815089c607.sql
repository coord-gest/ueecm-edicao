-- 1) Tabela de tentativas
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_key_created_idx
  ON public.rate_limits (key, created_at DESC);

-- 2) GRANTs — só backend acessa; nunca anon nem authenticated diretamente
GRANT ALL ON public.rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limits_id_seq TO service_role;

-- 3) RLS: bloqueia acesso direto (defense in depth)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits service only"
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4) Função principal — SECURITY DEFINER para poder inserir apesar da RLS.
-- Registra a tentativa e retorna TRUE se ainda pode prosseguir, FALSE se estourou o limite.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key TEXT,
  _max_requests INT,
  _window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF _key IS NULL OR length(_key) = 0 THEN
    RETURN TRUE; -- sem chave, não bloqueia
  END IF;

  -- Conta as tentativas dentro da janela
  SELECT count(*) INTO v_count
  FROM public.rate_limits
  WHERE key = _key
    AND created_at > now() - make_interval(secs => _window_seconds);

  IF v_count >= _max_requests THEN
    RETURN FALSE;
  END IF;

  -- Registra a tentativa atual
  INSERT INTO public.rate_limits (key) VALUES (_key);
  RETURN TRUE;
END;
$$;

-- Permite chamar do backend (service_role) e de triggers (que rodam como definer)
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO service_role;

-- 5) Cleanup: remove registros com mais de 24h (janelas maiores que isso não são o caso de uso)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE created_at < now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;