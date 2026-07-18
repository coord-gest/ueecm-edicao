
-- Authenticated users get full SELECT (RLS still filters rows).
-- Anonymous users keep restricted column access (no email/telefone).
GRANT SELECT ON public.profissionais TO authenticated;
