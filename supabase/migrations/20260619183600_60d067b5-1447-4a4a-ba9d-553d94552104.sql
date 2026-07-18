
CREATE OR REPLACE FUNCTION public.tg_push_queue_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_site_url text;
  v_secret   text;
BEGIN
  v_site_url := current_setting('app.site_url', true);
  v_secret   := current_setting('app.dispatch_secret', true);

  IF v_site_url IS NULL OR trim(v_site_url) = '' THEN
    RAISE WARNING '[tg_push_queue_dispatch] app.site_url não configurado';
    RETURN NEW;
  END IF;

  IF v_secret IS NULL OR trim(v_secret) = '' THEN
    RAISE WARNING '[tg_push_queue_dispatch] app.dispatch_secret não configurado — fila não será drenada automaticamente';
    RETURN NEW;
  END IF;

  v_site_url := rtrim(trim(v_site_url), '/');

  PERFORM net.http_post(
    url     := v_site_url || '/api/public/dispatch-push',
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-dispatch-secret', v_secret
               ),
    body    := '{}'::jsonb
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[tg_push_queue_dispatch] erro ao disparar HTTP: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_push_queue_dispatch() FROM PUBLIC, anon, authenticated;
