-- 1) Coluna de controle
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

-- 2) Trigger corrigido: só enfileira push se já passou do horário agendado
CREATE OR REPLACE FUNCTION public.tg_alerts_enqueue_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_title text; v_body text; v_url text;
BEGIN
  IF NEW.active IS NOT TRUE THEN RETURN NEW; END IF;

  -- Se está agendado para o futuro, não enfileira agora — o cron cuidará disso.
  IF NEW.starts_at IS NOT NULL AND NEW.starts_at > now() THEN
    RETURN NEW;
  END IF;

  -- Evita duplicar em updates que não mudam a mensagem
  IF TG_OP = 'UPDATE'
     AND OLD.active IS TRUE
     AND OLD.message = NEW.message
     AND OLD.push_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Se já foi enviado e nada relevante mudou, sai
  IF NEW.push_sent_at IS NOT NULL
     AND TG_OP = 'UPDATE'
     AND OLD.message = NEW.message THEN
    RETURN NEW;
  END IF;

  v_title := CASE NEW.variant
    WHEN 'destructive' THEN 'Alerta urgente'
    WHEN 'warning' THEN 'Aviso'
    WHEN 'success' THEN 'Comunicado'
    ELSE 'Informação'
  END;
  v_body := NEW.message;
  v_url := COALESCE(NEW.link_url, '/');

  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
  VALUES (v_title, v_body, v_url, 'alert', NEW.id);

  NEW.push_sent_at := now();
  RETURN NEW;
END;
$function$;

-- 3) Função chamada pelo cron para despachar alertas agendados que chegaram no horário
CREATE OR REPLACE FUNCTION public.enqueue_due_alert_pushes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count int := 0;
  v_title text;
BEGIN
  FOR r IN
    SELECT * FROM public.alerts
    WHERE active IS TRUE
      AND push_sent_at IS NULL
      AND starts_at IS NOT NULL
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    v_title := CASE r.variant
      WHEN 'destructive' THEN 'Alerta urgente'
      WHEN 'warning' THEN 'Aviso'
      WHEN 'success' THEN 'Comunicado'
      ELSE 'Informação'
    END;

    INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
    VALUES (v_title, r.message, COALESCE(r.link_url, '/'), 'alert', r.id);

    UPDATE public.alerts SET push_sent_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;