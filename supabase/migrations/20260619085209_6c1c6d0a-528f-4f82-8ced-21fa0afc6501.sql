
-- Bloqueia autor comum de publicar o próprio post
CREATE POLICY "posts_no_self_publish"
  ON public.posts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    public.is_school_staff(auth.uid())
    OR status::text <> 'publicado'
  );

-- Bloqueia broadcasts arbitrários no Realtime (app usa apenas postgres_changes)
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;
