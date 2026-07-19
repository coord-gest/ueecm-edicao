GRANT SELECT ON public.profissionais TO authenticated;

REVOKE SELECT (email, telefone, lattes_url) ON public.profissionais FROM anon;

GRANT SELECT (
  id, user_id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio,
  formacao, anos_experiencia, ano_ingresso, linkedin_url, site_url,
  ordem, ativo, destaque, created_by, created_at, updated_at, especializacoes
) ON public.profissionais TO anon;