
CREATE TABLE public.fcm_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT NULL,
  phase TEXT NOT NULL DEFAULT 'probe',
  success BOOLEAN NOT NULL DEFAULT false,
  is_iframe BOOLEAN NULL,
  is_preview BOOLEAN NULL,
  is_standalone BOOLEAN NULL,
  is_in_app_browser BOOLEAN NULL,
  notification_permission TEXT NULL,
  service_worker_supported BOOLEAN NULL,
  service_worker_registered BOOLEAN NULL,
  service_worker_script TEXT NULL,
  indexeddb_ok BOOLEAN NULL,
  cookies_enabled BOOLEAN NULL,
  fcm_config_ok BOOLEAN NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_fcm_diagnostics_created_at ON public.fcm_diagnostics (created_at DESC);
CREATE INDEX idx_fcm_diagnostics_success ON public.fcm_diagnostics (success, created_at DESC);
CREATE INDEX idx_fcm_diagnostics_platform ON public.fcm_diagnostics (platform, created_at DESC);

GRANT SELECT, INSERT ON public.fcm_diagnostics TO authenticated;
GRANT INSERT ON public.fcm_diagnostics TO anon;
GRANT ALL ON public.fcm_diagnostics TO service_role;

ALTER TABLE public.fcm_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert fcm diagnostics"
  ON public.fcm_diagnostics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "staff can read fcm diagnostics"
  ON public.fcm_diagnostics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('desenvolvedor','developer','admin','diretor','director')
    )
  );

CREATE OR REPLACE FUNCTION public.cleanup_fcm_diagnostics()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.fcm_diagnostics WHERE created_at < now() - interval '30 days';
$$;
