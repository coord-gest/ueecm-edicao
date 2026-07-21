-- Volta a view para security_invoker (evita alerta SECURITY DEFINER)
CREATE OR REPLACE VIEW public.configuracoes_tema_public
WITH (security_invoker = true) AS
SELECT id, tema, ativo, intensidade, updated_at
FROM public.configuracoes_tema;

GRANT SELECT ON public.configuracoes_tema_public TO anon, authenticated;

-- Concede leitura por coluna à base para anon/authenticated (exclui updated_by)
GRANT SELECT (id, tema, ativo, intensidade, updated_at)
  ON public.configuracoes_tema TO anon, authenticated;

-- Política RLS permitindo leitura pública das colunas seguras
DROP POLICY IF EXISTS "configuracoes_tema: leitura pública (colunas seguras)" ON public.configuracoes_tema;
CREATE POLICY "configuracoes_tema: leitura pública (colunas seguras)"
  ON public.configuracoes_tema FOR SELECT
  TO anon, authenticated
  USING (true);