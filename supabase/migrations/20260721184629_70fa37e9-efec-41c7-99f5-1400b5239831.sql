
ALTER TABLE public.comunicados
  ADD COLUMN IF NOT EXISTS requer_confirmacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_gestao_apos_horas integer;

ALTER TABLE public.comunicado_leituras
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_comunicados_requer_confirmacao
  ON public.comunicados(created_at DESC) WHERE requer_confirmacao = true;
