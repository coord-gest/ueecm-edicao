-- 1) Tabela
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  link_url text,
  link_label text,
  variant text NOT NULL DEFAULT 'info' CHECK (variant IN ('info','success','warning','destructive')),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants
GRANT SELECT ON public.alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

-- 3) RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Leitura pública de alertas ativos e não expirados
CREATE POLICY "Alertas ativos sao publicos"
  ON public.alerts FOR SELECT
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Gerentes (desenvolvedor/diretor/coordenador) podem ver todos
CREATE POLICY "Gerentes veem todos alertas"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (public.can_manage_staff(auth.uid()));

CREATE POLICY "Gerentes inserem alertas"
  ON public.alerts FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Gerentes atualizam alertas"
  ON public.alerts FOR UPDATE
  TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

CREATE POLICY "Gerentes excluem alertas"
  ON public.alerts FOR DELETE
  TO authenticated
  USING (public.can_manage_staff(auth.uid()));

-- 4) updated_at trigger (reusa tg_set_updated_at já existente)
CREATE TRIGGER set_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Audit log
CREATE TRIGGER audit_alerts
  AFTER INSERT OR UPDATE OR DELETE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

-- 6) Index
CREATE INDEX alerts_active_idx ON public.alerts (active, created_at DESC) WHERE active = true;

-- 7) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;