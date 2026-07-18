-- 1) push_subscriptions: remover SELECT/UPDATE/DELETE anônimos.
-- Vetor de ataque: anônimo lendo endpoint+p256dh+auth de subs com user_id IS NULL
-- consegue enviar push arbitrário ao dispositivo. INSERT anônimo permanece.
DROP POLICY IF EXISTS push_subs_select_anon ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_update_anon ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subs_delete_anon ON public.push_subscriptions;

-- 2) realtime.messages: RESTRICTIVE deny-all sobrepõe a PERMISSIVE 'false'
-- (que sozinha não bloqueia). Operações server-side com service_role continuam
-- funcionando porque service_role bypassa RLS.
DROP POLICY IF EXISTS realtime_broadcast_restrict_all ON realtime.messages;
CREATE POLICY realtime_broadcast_restrict_all
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 3) push_notifications_queue: permitir staff apagar entradas processadas
DROP POLICY IF EXISTS push_queue_staff_delete ON public.push_notifications_queue;
CREATE POLICY push_queue_staff_delete
ON public.push_notifications_queue
FOR DELETE
TO authenticated
USING (public.is_school_staff(auth.uid()));