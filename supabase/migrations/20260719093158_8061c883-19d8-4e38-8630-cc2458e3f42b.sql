-- Vínculo de consentimento parental (LGPD Art. 14) ao cadastro de alunos.
ALTER TABLE public.parental_consents
  ADD COLUMN IF NOT EXISTS aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE;

ALTER TABLE public.parental_consents ALTER COLUMN protocolo DROP NOT NULL;

CREATE INDEX IF NOT EXISTS parental_consents_aluno_idx
  ON public.parental_consents (aluno_id);

-- Pelo menos um dos identificadores (agendamento OU aluno) deve estar presente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parental_consents_target_chk'
  ) THEN
    ALTER TABLE public.parental_consents
      ADD CONSTRAINT parental_consents_target_chk
      CHECK (protocolo IS NOT NULL OR aluno_id IS NOT NULL);
  END IF;
END $$;