CREATE POLICY "Profissionais ativos: publico"
ON public.profissionais
FOR SELECT
TO anon
USING (ativo = true);