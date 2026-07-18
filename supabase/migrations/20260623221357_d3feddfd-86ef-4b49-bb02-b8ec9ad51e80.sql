
-- Replace public SELECT policy with manager-only
DROP POLICY IF EXISTS "Profissionais ativos são públicos" ON public.profissionais;

CREATE POLICY "Gestores leem profissionais"
ON public.profissionais
FOR SELECT
TO authenticated
USING (private.can_manage_staff(auth.uid()));

-- Public-safe view excluding sensitive fields (email, telefone)
CREATE OR REPLACE VIEW public.profissionais_publicos
WITH (security_invoker = false) AS
SELECT
  id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
  anos_experiencia, ano_ingresso, destaque, ordem, ativo, created_at, updated_at
FROM public.profissionais
WHERE ativo = true;

GRANT SELECT ON public.profissionais_publicos TO anon, authenticated;
