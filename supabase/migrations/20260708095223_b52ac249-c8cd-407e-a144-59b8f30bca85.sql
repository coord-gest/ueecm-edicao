-- Reanexa o dispatch automático da fila de push.
-- Sem esse trigger, itens enfileirados pelo cron enqueue_due_alert_pushes
-- ficam parados até alguém chamar /api/public/dispatch-push manualmente,
-- o que provoca "pushes atrasados sendo entregues em rajada" quando o
-- painel cria um novo alerta e chama dispatchPush().

DROP TRIGGER IF EXISTS push_queue_dispatch ON public.push_notifications_queue;

CREATE TRIGGER push_queue_dispatch
AFTER INSERT ON public.push_notifications_queue
FOR EACH ROW EXECUTE FUNCTION public.tg_push_queue_dispatch();