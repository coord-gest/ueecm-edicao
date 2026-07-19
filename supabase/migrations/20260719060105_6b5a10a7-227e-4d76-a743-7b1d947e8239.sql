
-- 1) Remove trigger quebrado (referencia NEW.user_id/NEW.payload — colunas
-- inexistentes na fila atual). Ele fazia toda INSERT em push_notifications_queue
-- falhar dentro do enqueue_due_alert_pushes(), causando rollback silencioso.
DROP TRIGGER IF EXISTS trg_push_queue_para_inapp ON public.push_notifications_queue;
DROP FUNCTION IF EXISTS public.fn_replicar_push_para_inapp();

-- 2) Torna o cron de alertas agendados tolerante a expires_at recém-vencido.
CREATE OR REPLACE FUNCTION public.enqueue_due_alert_pushes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count int := 0;
  v_title text;
BEGIN
  FOR r IN
    SELECT * FROM public.alerts
    WHERE active IS TRUE
      AND push_sent_at IS NULL
      AND starts_at IS NOT NULL
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now() - interval '10 minutes')
  LOOP
    v_title := CASE r.variant
      WHEN 'destructive' THEN 'Alerta urgente'
      WHEN 'warning' THEN 'Aviso'
      WHEN 'success' THEN 'Comunicado'
      ELSE 'Informação'
    END;

    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
    VALUES (v_title, r.message, COALESCE(r.link_url, '/'), 'alert', r.id);

    UPDATE public.alerts SET push_sent_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enqueue_due_alert_pushes() FROM PUBLIC, anon, authenticated;
