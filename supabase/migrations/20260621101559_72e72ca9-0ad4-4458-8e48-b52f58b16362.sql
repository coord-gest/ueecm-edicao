
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS push_subs_update_anon ON public.push_subscriptions;
CREATE POLICY push_subs_update_anon ON public.push_subscriptions
  FOR UPDATE TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS push_subs_select_anon ON public.push_subscriptions;
CREATE POLICY push_subs_select_anon ON public.push_subscriptions
  FOR SELECT TO anon
  USING (user_id IS NULL);
