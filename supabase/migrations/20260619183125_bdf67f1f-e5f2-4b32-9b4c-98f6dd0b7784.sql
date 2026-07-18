
-- 1. Push subscriptions: permitir anônimos (idempotente)
ALTER TABLE public.push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

GRANT INSERT, DELETE ON public.push_subscriptions TO anon;

DROP POLICY IF EXISTS "push_subs_insert_anon" ON public.push_subscriptions;
CREATE POLICY "push_subs_insert_anon" ON public.push_subscriptions
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "push_subs_delete_anon" ON public.push_subscriptions;
CREATE POLICY "push_subs_delete_anon" ON public.push_subscriptions
  FOR DELETE TO anon
  USING (user_id IS NULL);

DROP POLICY IF EXISTS "push_subs_insert_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert_auth_anon" ON public.push_subscriptions;
CREATE POLICY "push_subs_insert_auth_anon" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 2. Realtime broadcast/presence: deny-all (o app só usa postgres_changes,
-- que NÃO passa pela tabela realtime.messages — é filtrado pelo RLS das
-- tabelas de origem). Mantemos a policy explícita e restritiva para evitar
-- qualquer canal de broadcast/presence vazar dados se for adicionado por engano.
DROP POLICY IF EXISTS "realtime_authenticated_scoped_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
CREATE POLICY "realtime_broadcast_deny_all" ON realtime.messages
  FOR SELECT TO authenticated
  USING (false);
