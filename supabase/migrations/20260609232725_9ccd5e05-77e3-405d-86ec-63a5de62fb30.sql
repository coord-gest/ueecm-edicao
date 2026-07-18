DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker=on) AS
SELECT id, user_id, display_name, avatar_url, bio, cargo
FROM public.profiles
WHERE ativo = true;
GRANT SELECT ON public.profiles_public TO anon, authenticated;