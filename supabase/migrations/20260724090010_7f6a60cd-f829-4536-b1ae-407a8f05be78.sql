
CREATE TABLE public.code_of_ethics_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  UNIQUE (user_id, version)
);

GRANT SELECT, INSERT ON public.code_of_ethics_acceptances TO authenticated;
GRANT ALL ON public.code_of_ethics_acceptances TO service_role;

ALTER TABLE public.code_of_ethics_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ethics acceptance"
  ON public.code_of_ethics_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ethics acceptance"
  ON public.code_of_ethics_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_code_of_ethics_acceptances_user ON public.code_of_ethics_acceptances(user_id);
