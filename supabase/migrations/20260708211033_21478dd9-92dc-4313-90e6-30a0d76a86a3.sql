
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
      '/painel-erros',
      'system_error',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_system_errors_notify()
  FROM anon, authenticated, PUBLIC;
