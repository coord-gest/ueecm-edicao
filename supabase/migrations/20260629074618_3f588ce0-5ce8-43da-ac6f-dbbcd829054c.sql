
-- Allow upsert (which may UPDATE on conflict) for both anon and authenticated push subscribers.
DROP POLICY IF EXISTS push_subs_update_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_update_anon ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_insert_auth_anon ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_insert_anon ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_delete_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_delete_anon ON public.push_subscriptions;

-- INSERT: anon can insert rows with user_id null; authenticated can insert null or their own.
CREATE POLICY push_subs_insert_anon ON public.push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY push_subs_insert_auth ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- UPDATE: needed for upsert onConflict=endpoint.
CREATE POLICY push_subs_update_anon ON public.push_subscriptions
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY push_subs_update_auth ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- DELETE: own row, or anon-owned row from same device.
CREATE POLICY push_subs_delete_anon ON public.push_subscriptions
  FOR DELETE TO anon
  USING (user_id IS NULL);

CREATE POLICY push_subs_delete_auth ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
