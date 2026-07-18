
-- Restringir colunas sensíveis (email, telefone) da tabela profissionais para anon/authenticated.
-- Staff continua acessando via RPC admin_list_profissionais (SECURITY DEFINER).
REVOKE SELECT ON public.profissionais FROM anon, authenticated;

GRANT SELECT (
  id, user_id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio,
  formacao, anos_experiencia, ano_ingresso, lattes_url, linkedin_url,
  site_url, ordem, ativo, destaque, created_by, created_at, updated_at,
  especializacoes
) ON public.profissionais TO anon, authenticated;

-- Escrita continua funcionando via policies existentes (INSERT/UPDATE/DELETE)
GRANT INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;
