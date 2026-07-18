
-- 1. Tabela de settings privadas (substitui ALTER DATABASE SET app.*)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Sem GRANTs para anon/authenticated — só service_role e funções
-- SECURITY DEFINER podem ler.
REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_deny_all" ON public.app_settings;
CREATE POLICY "app_settings_deny_all" ON public.app_settings
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 2. Trigger lê da tabela em vez de current_setting
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
  SELECT value INTO v_site_url FROM public.app_settings WHERE key = 'site_url';
  SELECT value INTO v_secret   FROM public.app_settings WHERE key = 'dispatch_secret';

  IF v_site_url IS NULL OR trim(v_site_url) = '' THEN
    RAISE WARNING '[tg_push_queue_dispatch] site_url ausente em app_settings';
    RETURN NEW;
  END IF;

  IF v_secret IS NULL OR trim(v_secret) = '' THEN
    RAISE WARNING '[tg_push_queue_dispatch] dispatch_secret ausente em app_settings';
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
  RAISE WARNING '[tg_push_queue_dispatch] erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_push_queue_dispatch() FROM PUBLIC, anon, authenticated;
