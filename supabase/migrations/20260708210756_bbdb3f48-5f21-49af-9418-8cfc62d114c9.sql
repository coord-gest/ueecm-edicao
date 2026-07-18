
-- =========================================================================
-- 1) Endurecer EXECUTE de funções SECURITY DEFINER
-- =========================================================================

-- criar_agendamento: exige usuário autenticado (fn já usa auth.uid()).
REVOKE EXECUTE ON FUNCTION public.criar_agendamento(
  text, text, text, text, timestamptz, timestamptz, uuid, text
) FROM anon, PUBLIC;

-- enqueue_due_alert_pushes: cron/admin only.
REVOKE EXECUTE ON FUNCTION public.enqueue_due_alert_pushes()
  FROM anon, authenticated, PUBLIC;

-- tg_agendamento_enqueue_push: trigger interno, não precisa de EXECUTE público.
REVOKE EXECUTE ON FUNCTION public.tg_agendamento_enqueue_push()
  FROM anon, authenticated, PUBLIC;

-- =========================================================================
-- 2) Tabela de alertas de erros do servidor
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.system_errors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,          -- ex.: 'server_fn:getUserPosts', 'api:chat'
  severity     text NOT NULL DEFAULT 'error'
               CHECK (severity IN ('info','warning','error','critical')),
  message      text NOT NULL,
  stack        text,
  context      jsonb DEFAULT '{}'::jsonb,
  actor_id     uuid,
  request_path text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_errors_created_at_idx
  ON public.system_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS system_errors_severity_created_at_idx
  ON public.system_errors (severity, created_at DESC);

GRANT SELECT ON public.system_errors TO authenticated;
GRANT ALL    ON public.system_errors TO service_role;
-- INSERT ocorre exclusivamente via service_role (server functions);
-- não concedemos INSERT a anon/authenticated.

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff le erros do sistema"
  ON public.system_errors
  FOR SELECT
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

-- =========================================================================
-- 3) Notificação automática quando um erro CRITICAL é registrado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_system_errors_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
    VALUES (
      'Erro crítico no sistema',
      LEFT(NEW.source || ': ' || NEW.message, 240),
      '/painel/erros',
      'system_error',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_system_errors_notify()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_system_errors_notify ON public.system_errors;
CREATE TRIGGER trg_system_errors_notify
  AFTER INSERT ON public.system_errors
  FOR EACH ROW EXECUTE FUNCTION public.tg_system_errors_notify();

-- =========================================================================
-- 4) Retenção: manter só 30 dias de erros
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cleanup_system_errors()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.system_errors WHERE created_at < now() - interval '30 days';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_system_errors()
  FROM anon, authenticated, PUBLIC;
