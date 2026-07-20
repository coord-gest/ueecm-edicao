
-- 1) app-releases: exigir login para SELECT
DROP POLICY IF EXISTS "app-releases: leitura pública" ON storage.objects;
CREATE POLICY "app-releases: leitura autenticada"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'app-releases');

-- 2) configuracoes_tema: view pública sem updated_by e restringe base
CREATE OR REPLACE VIEW public.configuracoes_tema_public
WITH (security_invoker = true) AS
SELECT id, tema, ativo, intensidade, updated_at
FROM public.configuracoes_tema;

GRANT SELECT ON public.configuracoes_tema_public TO anon, authenticated;

-- Remove leitura pública ampla da base e mantém apenas admins
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='configuracoes_tema' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.configuracoes_tema', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "configuracoes_tema: admins leem base"
  ON public.configuracoes_tema FOR SELECT
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

-- Publica a view no realtime (o canal do cliente escuta a tabela original;
-- mantemos a tabela em publicação, mas anon perde acesso à base)
REVOKE SELECT ON public.configuracoes_tema FROM anon;

-- 3) justificativas: exigir aluno_id como 2º segmento e vínculo com responsável
DROP POLICY IF EXISTS "jf_bucket_write" ON storage.objects;
CREATE POLICY "jf_bucket_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'justificativas'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (storage.foldername(name))[2] IS NOT NULL
    AND (
      public.is_school_admin(auth.uid())
      OR public.is_responsavel_do_aluno(
           auth.uid(),
           ((storage.foldername(name))[2])::uuid
         )
    )
  );
