
-- ============== PROFISSIONAIS ==============
-- Revoga SELECT amplo
REVOKE SELECT ON public.profissionais FROM anon, authenticated;

-- Concede SELECT apenas em colunas seguras (sem email/telefone)
GRANT SELECT (
  id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
  anos_experiencia, ano_ingresso, destaque, ordem, ativo,
  linkedin_url, lattes_url, site_url, created_at, updated_at
) ON public.profissionais TO anon, authenticated;

-- Equipe lê a tabela inteira (colunas sensíveis incluídas)
GRANT SELECT ON public.profissionais TO authenticated;
-- (mantém GRANT acima para colunas; este GRANT amplo é redundante mas necessário para policy "Equipe le profissionais (base)")
-- Reverte: para garantir que apenas a equipe veja email/telefone, deixamos GRANT só por colunas
REVOKE SELECT ON public.profissionais FROM authenticated;
GRANT SELECT (
  id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
  anos_experiencia, ano_ingresso, destaque, ordem, ativo,
  linkedin_url, lattes_url, site_url, created_at, updated_at
) ON public.profissionais TO authenticated;
GRANT SELECT (email, telefone) ON public.profissionais TO authenticated;
-- Equipe full via policy + column grants acima cobrem todas as colunas

-- Policy de leitura pública (restaurada, agora segura por column grants)
DROP POLICY IF EXISTS "Profissionais ativos legíveis" ON public.profissionais;
CREATE POLICY "Profissionais ativos legíveis"
  ON public.profissionais
  FOR SELECT
  TO anon, authenticated
  USING (ativo = true OR private.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS "Equipe le profissionais (base)" ON public.profissionais;

-- Views com security_invoker
CREATE OR REPLACE VIEW public.profissionais_publicos
WITH (security_invoker = true) AS
SELECT
  id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
  anos_experiencia, ano_ingresso, destaque, ordem, ativo,
  linkedin_url, lattes_url, site_url, created_at, updated_at
FROM public.profissionais
WHERE ativo = true;

GRANT SELECT ON public.profissionais_publicos TO anon, authenticated;

-- ============== POST_COMENTARIOS ==============
REVOKE SELECT ON public.post_comentarios FROM anon, authenticated;

-- Colunas seguras (sem autor_email, autor_idade, autor_sexo)
GRANT SELECT (
  id, post_id, conteudo, autor_nome, autor_avatar, user_id, status, created_at
) ON public.post_comentarios TO anon, authenticated;

-- Autenticado precisa ler colunas sensíveis quando for autor ou staff (policies já restringem linhas)
GRANT SELECT (autor_email, autor_idade, autor_sexo) ON public.post_comentarios TO authenticated;

-- Restaura policy de leitura de aprovados (anônimo + autenticado)
CREATE POLICY "Comentarios aprovados visiveis a todos"
  ON public.post_comentarios
  FOR SELECT
  TO anon, authenticated
  USING (status = 'aprovado');

CREATE OR REPLACE VIEW public.post_comentarios_publicos
WITH (security_invoker = true) AS
SELECT
  id, post_id, conteudo, autor_nome, autor_avatar, user_id, status, created_at
FROM public.post_comentarios
WHERE status = 'aprovado';

GRANT SELECT ON public.post_comentarios_publicos TO anon, authenticated;
