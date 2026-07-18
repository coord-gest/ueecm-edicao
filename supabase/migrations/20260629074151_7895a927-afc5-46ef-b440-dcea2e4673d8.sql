
-- ============== PROFISSIONAIS ==============
DROP POLICY IF EXISTS "Profissionais ativos legíveis" ON public.profissionais;

CREATE POLICY "Equipe le profissionais (base)"
  ON public.profissionais
  FOR SELECT
  TO authenticated
  USING (private.can_manage_staff(auth.uid()));

CREATE OR REPLACE VIEW public.profissionais_publicos
WITH (security_invoker = false) AS
SELECT
  id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
  anos_experiencia, ano_ingresso, destaque, ordem, ativo,
  linkedin_url, lattes_url, site_url,
  created_at, updated_at
FROM public.profissionais
WHERE ativo = true;

REVOKE ALL ON public.profissionais_publicos FROM PUBLIC;
GRANT SELECT ON public.profissionais_publicos TO anon, authenticated;

-- ============== POST_COMENTARIOS ==============
DROP POLICY IF EXISTS "Comentarios aprovados visiveis a todos" ON public.post_comentarios;

CREATE OR REPLACE VIEW public.post_comentarios_publicos
WITH (security_invoker = false) AS
SELECT
  id, post_id, conteudo, autor_nome, autor_avatar, user_id, status, created_at
FROM public.post_comentarios
WHERE status = 'aprovado';

REVOKE ALL ON public.post_comentarios_publicos FROM PUBLIC;
GRANT SELECT ON public.post_comentarios_publicos TO anon, authenticated;
