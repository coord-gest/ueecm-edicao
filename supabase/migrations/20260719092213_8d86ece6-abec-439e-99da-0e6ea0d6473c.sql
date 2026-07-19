-- Defense-in-depth: autor só consegue UPDATE em posts que ainda não foram publicados.
-- Admin/staff continua podendo editar qualquer status.
DROP POLICY IF EXISTS posts_update ON public.posts;

CREATE POLICY posts_update ON public.posts
  FOR UPDATE
  USING (
    public.is_school_admin(auth.uid())
    OR (
      auth.uid() = autor_id
      AND status::text IN ('rascunho', 'pendente', 'rejeitado')
    )
  )
  WITH CHECK (
    public.is_school_admin(auth.uid())
    OR (
      auth.uid() = autor_id
      AND status::text <> 'publicado'
    )
  );