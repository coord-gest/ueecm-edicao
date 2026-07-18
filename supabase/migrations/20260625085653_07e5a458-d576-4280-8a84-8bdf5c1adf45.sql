
-- Restrict column-level SELECT on profissionais for anon role
REVOKE SELECT ON public.profissionais FROM anon;

GRANT SELECT (
  id, user_id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio,
  formacao, anos_experiencia, ano_ingresso, lattes_url, linkedin_url, site_url,
  ordem, ativo, destaque, created_by, created_at, updated_at
) ON public.profissionais TO anon;

-- Authenticated keeps full access (covered by table grants, but ensure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;
