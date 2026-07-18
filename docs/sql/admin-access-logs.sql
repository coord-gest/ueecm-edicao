-- Auditoria de acesso administrativo
-- Registra quando um perfil acessa uma área do painel e quando um acesso é negado.

CREATE TABLE IF NOT EXISTS public.admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  route text NOT NULL,
  area text,
  outcome text NOT NULL CHECK (outcome IN ('granted','denied')),
  roles text[] NOT NULL DEFAULT '{}',
  required_roles text[] NOT NULL DEFAULT '{}',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created_at
  ON public.admin_access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_user
  ON public.admin_access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_outcome
  ON public.admin_access_logs (outcome, created_at DESC);

GRANT SELECT, INSERT ON public.admin_access_logs TO authenticated;
GRANT ALL ON public.admin_access_logs TO service_role;

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode registrar seu próprio acesso (granted OU denied).
DROP POLICY IF EXISTS "insert_own_access_log" ON public.admin_access_logs;
CREATE POLICY "insert_own_access_log"
ON public.admin_access_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Apenas desenvolvedor / diretor podem visualizar os logs.
DROP POLICY IF EXISTS "select_admin_access_logs" ON public.admin_access_logs;
CREATE POLICY "select_admin_access_logs"
ON public.admin_access_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'desenvolvedor'::public.app_role)
  OR public.has_role(auth.uid(), 'diretor'::public.app_role)
);

-- Limpeza automática (30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_admin_access_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_access_logs
  WHERE created_at < now() - interval '30 days';
$$;
