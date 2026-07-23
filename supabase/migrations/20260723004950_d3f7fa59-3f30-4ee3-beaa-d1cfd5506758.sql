
-- Art. 14 LGPD: consentimento parental para destaques de alunos
ALTER TABLE public.alunos_destaque
  ADD COLUMN IF NOT EXISTS consentimento_responsavel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_versao text,
  ADD COLUMN IF NOT EXISTS consentimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_ip_hash text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_vinculo text;

-- Backfill legado: registros pré-existentes ficam marcados como 'legado' para trilha de auditoria
UPDATE public.alunos_destaque
  SET consentimento_responsavel = true,
      consentimento_versao = COALESCE(consentimento_versao, 'legado'),
      consentimento_em = COALESCE(consentimento_em, created_at)
  WHERE consentimento_versao IS NULL;

-- Regra dura: novos registros exigem consentimento válido
ALTER TABLE public.alunos_destaque
  DROP CONSTRAINT IF EXISTS alunos_destaque_consentimento_chk;
ALTER TABLE public.alunos_destaque
  ADD CONSTRAINT alunos_destaque_consentimento_chk
  CHECK (consentimento_responsavel = true AND consentimento_versao IS NOT NULL);

COMMENT ON COLUMN public.alunos_destaque.consentimento_responsavel IS 'LGPD Art. 14 - consentimento específico e em destaque do responsável legal';
COMMENT ON COLUMN public.alunos_destaque.consentimento_versao IS 'Versão do termo aceito (ex.: v1). "legado" para registros anteriores ao gate.';
