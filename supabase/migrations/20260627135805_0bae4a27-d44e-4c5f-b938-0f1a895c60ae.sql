
-- ====== Profissionais: ocultar email/telefone para anon e authenticated ======
REVOKE SELECT ON public.profissionais FROM anon;
REVOKE SELECT ON public.profissionais FROM authenticated;

GRANT SELECT (
  id, user_id, nome, foto_url, cargo, cargo_descricao, disciplinas,
  bio, formacao, anos_experiencia, ano_ingresso,
  lattes_url, linkedin_url, site_url,
  ordem, ativo, destaque, created_by, created_at, updated_at
) ON public.profissionais TO anon, authenticated;

-- RPC administrativa para a equipe gestora obter dados completos (incluindo email/telefone)
CREATE OR REPLACE FUNCTION public.admin_list_profissionais()
RETURNS SETOF public.profissionais
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.profissionais
  WHERE private.can_manage_staff(auth.uid())
  ORDER BY ordem NULLS LAST, nome;
$$;

REVOKE ALL ON FUNCTION public.admin_list_profissionais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profissionais() TO authenticated;

-- ====== Storage: política explícita de leitura para alert-images ======
DROP POLICY IF EXISTS "Public read alert images" ON storage.objects;
CREATE POLICY "Public read alert images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'alert-images');
