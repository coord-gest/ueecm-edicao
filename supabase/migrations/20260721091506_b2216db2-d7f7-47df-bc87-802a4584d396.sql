-- Permitir que a view pública do tema seja legível por anon/authenticated
-- executando com privilégios do dono (bypass da RLS da tabela base),
-- expondo apenas colunas seguras (sem updated_by).
CREATE OR REPLACE VIEW public.configuracoes_tema_public
WITH (security_invoker = false) AS
SELECT id, tema, ativo, intensidade, updated_at
FROM public.configuracoes_tema;

GRANT SELECT ON public.configuracoes_tema_public TO anon, authenticated;