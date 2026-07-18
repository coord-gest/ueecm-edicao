
-- Reabilita SELECT nas colunas email e telefone para authenticated.
-- anon continua sem essas colunas (segurança contra exposição pública).
GRANT SELECT (email, telefone) ON public.profissionais TO authenticated;
