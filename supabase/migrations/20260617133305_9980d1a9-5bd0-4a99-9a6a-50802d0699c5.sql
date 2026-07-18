
-- 1) Posts: remove acesso anônimo às colunas de autor
REVOKE SELECT (autor, autor_id) ON public.posts FROM anon;

-- 2) Profissionais: remove acesso anônimo a e-mail/telefone
REVOKE SELECT (email, telefone) ON public.profissionais FROM anon;

-- 3) Audit logs: somente desenvolvedor
DROP POLICY IF EXISTS audit_select_staff ON public.audit_logs;
CREATE POLICY audit_select_desenvolvedor
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'desenvolvedor'::app_role));
