-- 1. Profissionais: remover acesso anon a email/telefone (column-level)
REVOKE SELECT (email, telefone) ON public.profissionais FROM anon;

-- 2. Storage: remover políticas órfãs do bucket 'books'
DROP POLICY IF EXISTS books_read_auth ON storage.objects;
DROP POLICY IF EXISTS books_write_staff ON storage.objects;

-- 3. Posts: sanitizar coluna autor (remover e-mails existentes)
UPDATE public.posts
SET autor = split_part(autor, '@', 1)
WHERE autor LIKE '%@%';