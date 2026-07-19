
ALTER TABLE public.push_notifications_queue
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','partial')),
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE INDEX IF NOT EXISTS idx_push_queue_source
  ON public.push_notifications_queue (source, source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.alert_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NULL REFERENCES public.alerts(id) ON DELETE SET NULL,
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (action IN (
    'created','updated','deleted','activated','deactivated',
    'resend_push','burst_scheduled','burst_cancelled','burst_tick','rate_limited'
  )),
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success','failed','rate_limited')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_audit_created ON public.alert_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_audit_alert ON public.alert_audit_logs (alert_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_audit_action ON public.alert_audit_logs (action, created_at DESC);

GRANT SELECT, INSERT ON public.alert_audit_logs TO authenticated;
GRANT ALL ON public.alert_audit_logs TO service_role;

ALTER TABLE public.alert_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_audit_insert_self" ON public.alert_audit_logs;
CREATE POLICY "alert_audit_insert_self"
ON public.alert_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND public.is_school_admin(auth.uid())
);

DROP POLICY IF EXISTS "alert_audit_select_staff" ON public.alert_audit_logs;
CREATE POLICY "alert_audit_select_staff"
ON public.alert_audit_logs
FOR SELECT
TO authenticated
USING (public.is_school_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_alert_action(
  _alert_id uuid,
  _action text,
  _result text,
  _details jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;
  IF NOT public.is_school_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso restrito';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.alert_audit_logs (alert_id, actor_id, actor_email, action, result, details)
  VALUES (_alert_id, auth.uid(), v_email, _action, COALESCE(_result, 'success'), COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_alert_action(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_alert_action(uuid, text, text, jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.alert_burst_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  interval_minutes int NOT NULL CHECK (interval_minutes BETWEEN 1 AND 1440),
  repeat_count int NOT NULL CHECK (repeat_count BETWEEN 1 AND 50),
  sent_count int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  cancelled_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_burst_next ON public.alert_burst_schedules (active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_burst_created ON public.alert_burst_schedules (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.alert_burst_schedules TO authenticated;
GRANT ALL ON public.alert_burst_schedules TO service_role;

ALTER TABLE public.alert_burst_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "burst_select_staff" ON public.alert_burst_schedules;
CREATE POLICY "burst_select_staff"
ON public.alert_burst_schedules
FOR SELECT TO authenticated
USING (public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS "burst_insert_staff" ON public.alert_burst_schedules;
CREATE POLICY "burst_insert_staff"
ON public.alert_burst_schedules
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.is_school_admin(auth.uid()));

DROP POLICY IF EXISTS "burst_update_staff" ON public.alert_burst_schedules;
CREATE POLICY "burst_update_staff"
ON public.alert_burst_schedules
FOR UPDATE TO authenticated
USING (public.is_school_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_burst_updated_at ON public.alert_burst_schedules;
CREATE TRIGGER trg_burst_updated_at
BEFORE UPDATE ON public.alert_burst_schedules
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Função que roda uma tick de rajada — chamada pelo cron
CREATE OR REPLACE FUNCTION public.process_alert_burst_tick()
RETURNS TABLE(processed int, enqueued int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_proc int := 0;
  v_enq  int := 0;
  v_title text;
  v_body text;
  v_url text;
BEGIN
  FOR r IN
    SELECT bs.*, a.message, a.variant, a.link_url
    FROM public.alert_burst_schedules bs
    JOIN public.alerts a ON a.id = bs.alert_id
    WHERE bs.active IS TRUE
      AND bs.next_run_at <= now()
      AND bs.sent_count < bs.repeat_count
      AND a.active IS TRUE
    ORDER BY bs.next_run_at
    LIMIT 50
  LOOP
    v_title := CASE r.variant
      WHEN 'destructive' THEN '🚨 Alerta urgente'
      WHEN 'warning' THEN '⚠️ Aviso'
      WHEN 'success' THEN '✅ Comunicado'
      ELSE '📢 Informação'
    END;
    v_body := r.message;
    v_url := COALESCE(r.link_url, '/');

    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
    VALUES (v_title, v_body, v_url, 'alert', r.alert_id);

    UPDATE public.alert_burst_schedules
    SET sent_count = sent_count + 1,
        last_run_at = now(),
        next_run_at = now() + make_interval(mins => interval_minutes),
        active = CASE WHEN sent_count + 1 >= repeat_count THEN false ELSE true END
    WHERE id = r.id;

    INSERT INTO public.alert_audit_logs (alert_id, actor_id, actor_email, action, result, details)
    VALUES (r.alert_id, r.created_by, NULL, 'burst_tick', 'success',
      jsonb_build_object('burst_id', r.id, 'sent_count', r.sent_count + 1, 'total', r.repeat_count));

    v_proc := v_proc + 1;
    v_enq  := v_enq  + 1;
  END LOOP;

  RETURN QUERY SELECT v_proc, v_enq;
END;
$$;

REVOKE ALL ON FUNCTION public.process_alert_burst_tick() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_alert_burst_tick() TO service_role;

-- Agendar cron a cada minuto
DO $$
BEGIN
  PERFORM cron.unschedule('alert-burst-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'alert-burst-tick',
  '* * * * *',
  $$SELECT public.process_alert_burst_tick();$$
);
