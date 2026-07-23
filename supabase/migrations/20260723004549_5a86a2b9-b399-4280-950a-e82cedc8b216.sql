ALTER TABLE public.familias_depoimentos
  ADD COLUMN IF NOT EXISTS consentimento_lgpd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS consentimento_versao text,
  ADD COLUMN IF NOT EXISTS autor_maior_idade boolean NOT NULL DEFAULT false;

-- Backfill: marca registros pré-existentes como consentimento legado (data de criação).
UPDATE public.familias_depoimentos
SET consentimento_lgpd = true,
    consentimento_em = COALESCE(consentimento_em, created_at, now()),
    consentimento_versao = COALESCE(consentimento_versao, 'legado')
WHERE consentimento_lgpd = false OR consentimento_em IS NULL;

ALTER TABLE public.familias_depoimentos
  DROP CONSTRAINT IF EXISTS familias_depoimentos_consentimento_chk;
ALTER TABLE public.familias_depoimentos
  ADD CONSTRAINT familias_depoimentos_consentimento_chk
  CHECK (consentimento_lgpd = true AND consentimento_em IS NOT NULL);