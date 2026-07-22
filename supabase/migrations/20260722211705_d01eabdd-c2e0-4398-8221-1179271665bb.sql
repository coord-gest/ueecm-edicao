DROP TRIGGER IF EXISTS trg_system_errors_notify ON public.system_errors;

CREATE OR REPLACE FUNCTION public.tg_system_errors_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desativado: notificações push de erros críticos foram removidas
  -- para evitar ruído aos usuários. Erros seguem registrados em
  -- public.system_errors e visíveis no Painel de Erros.
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_system_errors_notify() FROM anon, authenticated, PUBLIC;

DELETE FROM public.push_notifications_queue
WHERE source = 'system_error' AND processed_at IS NULL;