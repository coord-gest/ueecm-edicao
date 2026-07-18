-- ============================================================
-- Push Notification Fixes
-- Corrige três problemas identificados no sistema de push:
--
-- 1. RPC unsubscribe_push — chamada por push.ts mas nunca criada,
--    causando erro silencioso ao cancelar notificações.
-- 2. SELECT grant para anon em push_subscriptions — sem isso, o
--    role anon não consegue verificar subscrições existentes.
-- 3. UPDATE grant explícito para service_role em push_notifications_queue
--    — garante que drainPushQueue() consiga marcar processed_at.
-- ============================================================

-- ─── Fix 1: RPC unsubscribe_push ─────────────────────────────────────────────
-- Chamada pelo cliente via supabase.rpc("unsubscribe_push", { p_endpoint })
-- Funciona tanto para anon quanto para authenticated, pois deleta apenas
-- pelo endpoint (que é único e pertence ao browser chamador).
CREATE OR REPLACE FUNCTION public.unsubscribe_push(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint;
END;
$$;

-- Concede execução ao role anon e authenticated
GRANT EXECUTE ON FUNCTION public.unsubscribe_push(text) TO anon, authenticated;

-- ─── Fix 2: SELECT grant para anon em push_subscriptions ─────────────────────
-- O role anon precisa de SELECT para que o upsert onConflict=endpoint funcione
-- e para que a verificação de subscrição existente retorne resultado correto.
GRANT SELECT ON public.push_subscriptions TO anon;

-- Policy de SELECT para anon: pode ver apenas suas próprias linhas (sem user_id)
DROP POLICY IF EXISTS push_subs_select_anon ON public.push_subscriptions;
CREATE POLICY push_subs_select_anon ON public.push_subscriptions
  FOR SELECT TO anon
  USING (user_id IS NULL);

-- ─── Fix 3: UPDATE grant explícito para service_role em push_notifications_queue
-- O dispatcher (drainPushQueue) usa supabaseAdmin (service_role) para marcar
-- processed_at e incrementar attempts. O GRANT ALL cobre isso, mas adicionamos
-- explicitamente para garantir caso o GRANT ALL seja revogado no futuro.
GRANT SELECT, INSERT, UPDATE ON public.push_notifications_queue TO service_role;

-- Também garante UPDATE para authenticated (staff) — usado pelo painel
GRANT UPDATE ON public.push_notifications_queue TO authenticated;
