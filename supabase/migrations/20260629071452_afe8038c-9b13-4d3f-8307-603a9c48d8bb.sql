
-- 1) Remove a SELECT pública ampla que expunha colunas sensíveis (email, idade, sexo)
DROP POLICY IF EXISTS "Comentarios aprovados visiveis a todos" ON public.post_comentarios;

-- 2) View pública só com colunas seguras (sem email/idade/sexo)
CREATE OR REPLACE VIEW public.post_comentarios_publicos
WITH (security_invoker = false) AS
SELECT
  id,
  post_id,
  conteudo,
  autor_nome,
  autor_avatar,
  user_id,
  status,
  created_at
FROM public.post_comentarios
WHERE status = 'aprovado';

GRANT SELECT ON public.post_comentarios_publicos TO anon, authenticated;

-- 3) Tabela best-effort para throttling server-side de comentários por IP+post
CREATE TABLE IF NOT EXISTS public.comentario_rate_limit (
  ip text NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comentario_rate_limit_lookup
  ON public.comentario_rate_limit (ip, post_id, created_at DESC);

ALTER TABLE public.comentario_rate_limit ENABLE ROW LEVEL SECURITY;
-- Apenas service_role escreve/lê (route POST usa supabaseAdmin)
GRANT ALL ON public.comentario_rate_limit TO service_role;
