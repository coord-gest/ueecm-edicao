CREATE OR REPLACE FUNCTION public.tg_agendamento_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  active_count int;
BEGIN
  IF public.is_school_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.solicitante_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.agendamentos
  WHERE solicitante_user_id = NEW.solicitante_user_id
    AND created_at > now() - interval '10 minutes';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Limite de agendamentos atingido. Aguarde alguns minutos antes de solicitar outro.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO active_count
  FROM public.agendamentos
  WHERE solicitante_user_id = NEW.solicitante_user_id
    AND status NOT IN ('cancelado', 'concluido', 'recusado');

  IF active_count >= 10 THEN
    RAISE EXCEPTION 'Voce ja possui muitos agendamentos em aberto. Cancele ou aguarde a conclusao de alguns antes de criar novos.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_agendamento_rate_limit()
  FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS trg_agendamento_rate_limit ON public.agendamentos;
CREATE TRIGGER trg_agendamento_rate_limit
  BEFORE INSERT ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_agendamento_rate_limit();

CREATE INDEX IF NOT EXISTS agendamentos_solicitante_created_at_idx
  ON public.agendamentos (solicitante_user_id, created_at DESC);