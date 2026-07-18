
-- Torna a view de profissionais legível pelo público (visitantes não autenticados),
-- expondo apenas colunas seguras. Dados sensíveis (email, telefone) permanecem
-- restritos na tabela base `profissionais`.

-- Recria a view garantindo apenas colunas públicas e execução como owner
-- (security_invoker=off) para contornar RLS da tabela base de forma segura,
-- já que a view não expõe colunas sensíveis.
DROP VIEW IF EXISTS public.profissionais_publicos;
CREATE VIEW public.profissionais_publicos
WITH (security_invoker = off) AS
  SELECT
    id, nome, foto_url, cargo, cargo_descricao, disciplinas,
    bio, formacao, anos_experiencia, ano_ingresso,
    destaque, ordem, ativo, created_at, updated_at,
    linkedin_url, lattes_url, site_url
  FROM public.profissionais
  WHERE ativo = true;

-- Libera leitura pública apenas da view segura.
GRANT SELECT ON public.profissionais_publicos TO anon, authenticated;
