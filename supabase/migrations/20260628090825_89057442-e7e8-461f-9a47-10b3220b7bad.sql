
-- 1. profissionais: esconder email/telefone de anon e authenticated.
-- Equipe administrativa continua acessando via public.admin_list_profissionais() (SECURITY DEFINER).
REVOKE SELECT (email, telefone) ON public.profissionais FROM anon;
REVOKE SELECT (email, telefone) ON public.profissionais FROM authenticated;

-- 2. alert-images: remover listagem ampla. Bucket continua público via URL direta.
DROP POLICY IF EXISTS "Authenticated can list alert images" ON storage.objects;

-- 3. comunicados-anexos: adicionar policy de UPDATE (dono do arquivo ou admin escolar).
CREATE POLICY "comunicados anexos update owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'comunicados-anexos'
    AND (owner = auth.uid() OR public.is_school_admin(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'comunicados-anexos'
    AND (owner = auth.uid() OR public.is_school_admin(auth.uid()))
  );

-- 4. Revogar EXECUTE de funções SECURITY DEFINER que só são usadas como gatilhos.
-- Elas continuam executando normalmente nos triggers (com privilégios do owner),
-- mas não ficam mais expostas via PostgREST para usuários logados.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_push_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_alerts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_posts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_comunicado_enqueue_push() FROM PUBLIC, anon, authenticated;
