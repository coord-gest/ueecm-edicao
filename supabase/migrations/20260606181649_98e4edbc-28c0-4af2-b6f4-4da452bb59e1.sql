
-- Audit logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit: dev lê" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'desenvolvedor'::app_role));

CREATE POLICY "Audit: gestão grava" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_manager(auth.uid()));

CREATE INDEX audit_logs_table_created_idx ON public.audit_logs (table_name, created_at DESC);

-- Generic audit trigger
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE user_id = v_actor LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, table_name, record_id, action, after)
    VALUES (v_actor, v_email, TG_TABLE_NAME, NEW.id, 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, table_name, record_id, action, before, after)
    VALUES (v_actor, v_email, TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(actor_id, actor_email, table_name, record_id, action, before)
    VALUES (v_actor, v_email, TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_turmas
AFTER INSERT OR UPDATE OR DELETE ON public.turmas
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_disciplinas
AFTER INSERT OR UPDATE OR DELETE ON public.disciplinas
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_horarios
AFTER INSERT OR UPDATE OR DELETE ON public.horarios
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Realtime
ALTER TABLE public.turmas REPLICA IDENTITY FULL;
ALTER TABLE public.disciplinas REPLICA IDENTITY FULL;
ALTER TABLE public.horarios REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.turmas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.disciplinas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
