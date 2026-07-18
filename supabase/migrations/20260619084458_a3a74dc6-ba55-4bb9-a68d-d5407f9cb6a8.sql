
-- 1) Esconde email/telefone de profissionais para anon
REVOKE SELECT (email, telefone) ON public.profissionais FROM anon;

-- 2) profiles: corrige escopo das policies (public -> authenticated)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()));

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR public.is_school_staff(auth.uid()));

-- 3) user_roles: barra explicitamente escrita por não-desenvolvedores
CREATE POLICY "user_roles_block_non_dev_writes"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'desenvolvedor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'desenvolvedor'::app_role));
