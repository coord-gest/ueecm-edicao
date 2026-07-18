CREATE TABLE public.parental_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo text NOT NULL,
  minor_name text NOT NULL,
  minor_dob date NOT NULL,
  guardian_name text NOT NULL,
  guardian_cpf text NOT NULL,
  guardian_email text NOT NULL,
  guardian_phone text,
  term_version text NOT NULL,
  ip_address text,
  user_agent text,
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX parental_consents_protocolo_idx ON public.parental_consents (protocolo);
CREATE INDEX parental_consents_consented_at_idx ON public.parental_consents (consented_at DESC);

GRANT SELECT ON public.parental_consents TO authenticated;
GRANT ALL ON public.parental_consents TO service_role;

ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins can view parental consents"
  ON public.parental_consents
  FOR SELECT
  TO authenticated
  USING (public.is_school_admin(auth.uid()));