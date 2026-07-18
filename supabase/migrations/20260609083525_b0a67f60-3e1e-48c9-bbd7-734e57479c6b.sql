
-- 1) Profiles: drop overly permissive SELECT policies
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;

CREATE POLICY profiles_select_self_or_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_school_staff(auth.uid()));

-- 2) Safe public view exposing only non-sensitive fields
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT id, user_id, display_name, avatar_url, bio, cargo
FROM public.profiles
WHERE ativo = true;

REVOKE ALL ON public.profiles_public FROM PUBLIC;
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- 3) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
