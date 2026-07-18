-- =============================================================
-- Cria o bucket posts-media para upload de capas e imagens
-- do editor. Execute no SQL Editor do Supabase.
-- =============================================================

-- 1. Cria o bucket público (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts-media',
  'posts-media',
  true,
  5242880,   -- 5 MB por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- 2. Qualquer pessoa pode LER arquivos do bucket (blog é público)
DROP POLICY IF EXISTS "posts-media: leitura pública" ON storage.objects;
CREATE POLICY "posts-media: leitura pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts-media');

-- 3. Apenas staff autenticado pode fazer UPLOAD
DROP POLICY IF EXISTS "posts-media: upload staff" ON storage.objects;
CREATE POLICY "posts-media: upload staff"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posts-media'
    AND public.is_staff(auth.uid())
  );

-- 4. Apenas staff pode DELETAR seus próprios arquivos
DROP POLICY IF EXISTS "posts-media: delete staff" ON storage.objects;
CREATE POLICY "posts-media: delete staff"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'posts-media'
    AND public.is_staff(auth.uid())
  );
