
-- Remove previous view (avoids security-definer-view lint)
DROP VIEW IF EXISTS public.profissionais_publicos;

-- Replace policy: anyone can read active rows, managers can read all
DROP POLICY IF EXISTS "Gestores leem profissionais" ON public.profissionais;

CREATE POLICY "Profissionais ativos legíveis"
ON public.profissionais
FOR SELECT
TO anon, authenticated
USING (ativo = true OR private.can_manage_staff(auth.uid()));

-- Column-level grants: hide email and telefone from anon/authenticated reads.
-- RLS still filters rows; column grants further restrict accessible columns.
REVOKE SELECT ON public.profissionais FROM anon, authenticated;

GRANT SELECT
  (id, nome, foto_url, cargo, cargo_descricao, disciplinas, bio, formacao,
   anos_experiencia, ano_ingresso, lattes_url, linkedin_url, site_url,
   destaque, ordem, ativo, created_at, updated_at)
ON public.profissionais TO anon, authenticated;

GRANT SELECT ON public.profissionais TO service_role;

-- Manager-only RPC for the admin panel needing full records incl. email/telefone
CREATE OR REPLACE FUNCTION public.admin_list_profissionais()
RETURNS SETOF public.profissionais
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.can_manage_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT * FROM public.profissionais
    ORDER BY ordem ASC, nome ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_profissionais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_profissionais() TO authenticated;
