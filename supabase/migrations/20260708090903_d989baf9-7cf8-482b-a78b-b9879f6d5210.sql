-- Trigger precisa ser BEFORE para que NEW.push_sent_at := now() persista
DROP TRIGGER IF EXISTS alerts_enqueue_push ON public.alerts;
CREATE TRIGGER alerts_enqueue_push
  BEFORE INSERT OR UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_alerts_enqueue_push();

-- Backfill: alertas já ativos sem starts_at (fluxo imediato antigo) marcam como já enviados,
-- para que edições posteriores não reenfileirem push. Alertas agendados futuros ficam com
-- push_sent_at NULL para o cron processar no horário certo.
UPDATE public.alerts
SET push_sent_at = COALESCE(created_at, now())
WHERE push_sent_at IS NULL
  AND (starts_at IS NULL OR starts_at <= now());