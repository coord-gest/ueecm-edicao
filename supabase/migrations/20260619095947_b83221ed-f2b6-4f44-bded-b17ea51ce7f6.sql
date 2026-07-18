
-- 1) push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "push_subs_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) push_notifications_queue
CREATE TABLE public.push_notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  source text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE ON public.push_notifications_queue TO authenticated;
GRANT ALL ON public.push_notifications_queue TO service_role;

ALTER TABLE public.push_notifications_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_queue_staff_select" ON public.push_notifications_queue
  FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid()));
CREATE POLICY "push_queue_staff_insert" ON public.push_notifications_queue
  FOR INSERT TO authenticated WITH CHECK (public.is_school_staff(auth.uid()));
CREATE POLICY "push_queue_staff_update" ON public.push_notifications_queue
  FOR UPDATE TO authenticated USING (public.is_school_staff(auth.uid()));

-- 3) Trigger: enfileira em alerts
CREATE OR REPLACE FUNCTION public.tg_alerts_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title text; v_body text; v_url text;
BEGIN
  IF NEW.active IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.active IS TRUE AND OLD.message = NEW.message THEN
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER alerts_enqueue_push
AFTER INSERT OR UPDATE ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.tg_alerts_enqueue_push();

-- 4) Trigger: enfileira em posts (publicado)
CREATE OR REPLACE FUNCTION public.tg_posts_enqueue_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'publicado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'publicado' THEN RETURN NEW; END IF;
  INSERT INTO public.push_notifications_queue (title, body, url, source, source_id)
  VALUES (
    'Nova publicação no blog',
    COALESCE(NEW.titulo, 'Confira a nova publicação'),
    '/posts/' || NEW.id::text,
    'post',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_enqueue_push
AFTER INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.tg_posts_enqueue_push();
