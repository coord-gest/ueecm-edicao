-- posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS imagem text,
  ADD COLUMN IF NOT EXISTS geral boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

-- horarios
ALTER TABLE public.horarios
  ADD COLUMN IF NOT EXISTS turma_id uuid,
  ADD COLUMN IF NOT EXISTS disciplina_id uuid,
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;

-- audit_logs rename to english names
ALTER TABLE public.audit_logs RENAME COLUMN tabela TO table_name;
ALTER TABLE public.audit_logs RENAME COLUMN registro_id TO record_id;
ALTER TABLE public.audit_logs RENAME COLUMN acao TO action;
ALTER TABLE public.audit_logs RENAME COLUMN usuario_email TO actor_email;
ALTER TABLE public.audit_logs RENAME COLUMN usuario_id TO actor_id;
ALTER TABLE public.audit_logs RENAME COLUMN dados_antigos TO old_data;
ALTER TABLE public.audit_logs RENAME COLUMN dados_novos TO new_data;

CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_id, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;