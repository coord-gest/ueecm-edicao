REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;