-- Remove PII exposure on public reads of alunos_destaque.
-- Public consumers must go through the alunos_destaque_publicos view,
-- which excludes responsavel_nome, consentimento_ip_hash and other consent metadata.
DROP POLICY IF EXISTS "alunos_destaque_select_public" ON public.alunos_destaque;

-- Ensure the public view is readable by anon/authenticated (safe columns only).
GRANT SELECT ON public.alunos_destaque_publicos TO anon, authenticated;