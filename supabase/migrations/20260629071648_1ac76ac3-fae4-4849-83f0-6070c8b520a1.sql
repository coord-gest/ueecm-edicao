
-- Reverte view problemática (security definer)
DROP VIEW IF EXISTS public.post_comentarios_publicos;

-- Reativa SELECT público de comentários aprovados (apenas linhas)
CREATE POLICY "Comentarios aprovados visiveis a todos"
  ON public.post_comentarios
  FOR SELECT
  TO anon, authenticated
  USING (status = 'aprovado');

-- Protege colunas sensíveis a nível de coluna (anon não recebe os campos)
REVOKE SELECT (autor_email, autor_idade, autor_sexo)
  ON public.post_comentarios FROM anon;
REVOKE SELECT (autor_email, autor_idade, autor_sexo)
  ON public.post_comentarios FROM authenticated;
-- Equipe (staff) continua vendo via service_role nos painéis administrativos
-- e via política "Staff ve todos comentarios" usando RPC/edge se necessário.
-- Os campos sensíveis continuam acessíveis ao próprio dono (user_id) e ao
-- service_role; coordenação/diretoria consultará via painel administrativo
-- com função SECURITY DEFINER se precisar dos dados completos.

-- Remove tabela best-effort não utilizada
DROP TABLE IF EXISTS public.comentario_rate_limit;
