
-- 1) Drop overly permissive chat policies
DROP POLICY IF EXISTS "anyone can insert conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "anyone can read conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "anyone can update conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "anyone can insert message" ON public.chat_messages;
DROP POLICY IF EXISTS "anyone can read message" ON public.chat_messages;

-- 2) Private schema for SECURITY DEFINER role helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION private.is_school_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('desenvolvedor','admin','diretor','coordenador','secretario')) $$;

CREATE OR REPLACE FUNCTION private.can_manage_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('desenvolvedor','diretor','coordenador')) $$;

CREATE OR REPLACE FUNCTION private.can_manage_content(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('desenvolvedor','admin','diretor','coordenador','secretario','professor')) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_school_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_school_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_content(uuid) TO anon, authenticated;

-- 3) Recreate policies pointing at private.*

-- user_roles
DROP POLICY IF EXISTS "Usuários veem seus próprios papéis" ON public.user_roles;
DROP POLICY IF EXISTS "Desenvolvedores gerenciam papéis" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_block_non_dev_writes" ON public.user_roles;
CREATE POLICY "Usuários veem seus próprios papéis" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "Desenvolvedores gerenciam papéis" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));
CREATE POLICY "user_roles_block_non_dev_writes" ON public.user_roles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));

-- horarios
DROP POLICY IF EXISTS "horarios_select" ON public.horarios;
DROP POLICY IF EXISTS "horarios_manage" ON public.horarios;
CREATE POLICY "horarios_select" ON public.horarios
  FOR SELECT TO anon, authenticated
  USING ((ativo IS TRUE) OR private.can_manage_staff(auth.uid()));
CREATE POLICY "horarios_manage" ON public.horarios
  FOR ALL TO authenticated
  USING (private.can_manage_staff(auth.uid()))
  WITH CHECK (private.can_manage_staff(auth.uid()));

-- turmas
DROP POLICY IF EXISTS "turmas_select" ON public.turmas;
DROP POLICY IF EXISTS "turmas_manage" ON public.turmas;
CREATE POLICY "turmas_select" ON public.turmas
  FOR SELECT TO anon, authenticated
  USING ((ativo IS TRUE) OR private.can_manage_staff(auth.uid()));
CREATE POLICY "turmas_manage" ON public.turmas
  FOR ALL TO authenticated
  USING (private.can_manage_staff(auth.uid()))
  WITH CHECK (private.can_manage_staff(auth.uid()));

-- disciplinas
DROP POLICY IF EXISTS "disciplinas_select" ON public.disciplinas;
DROP POLICY IF EXISTS "disciplinas_manage" ON public.disciplinas;
CREATE POLICY "disciplinas_select" ON public.disciplinas
  FOR SELECT TO anon, authenticated
  USING ((ativo IS TRUE) OR private.can_manage_staff(auth.uid()));
CREATE POLICY "disciplinas_manage" ON public.disciplinas
  FOR ALL TO authenticated
  USING (private.can_manage_staff(auth.uid()))
  WITH CHECK (private.can_manage_staff(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "profiles_delete_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_staff" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_delete_staff" ON public.profiles
  FOR DELETE TO authenticated USING (private.is_school_staff(auth.uid()));
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR private.is_school_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) OR private.is_school_staff(auth.uid()))
  WITH CHECK ((auth.uid() = user_id) OR private.is_school_staff(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR private.is_school_staff(auth.uid()));

-- profissionais
DROP POLICY IF EXISTS "Profissionais ativos são públicos" ON public.profissionais;
DROP POLICY IF EXISTS "Gestores podem inserir profissionais" ON public.profissionais;
DROP POLICY IF EXISTS "Gestores podem atualizar profissionais" ON public.profissionais;
DROP POLICY IF EXISTS "Gestores podem remover profissionais" ON public.profissionais;
CREATE POLICY "Profissionais ativos são públicos" ON public.profissionais
  FOR SELECT USING ((ativo = true) OR private.can_manage_staff(auth.uid()));
CREATE POLICY "Gestores podem inserir profissionais" ON public.profissionais
  FOR INSERT TO authenticated WITH CHECK (private.can_manage_staff(auth.uid()));
CREATE POLICY "Gestores podem atualizar profissionais" ON public.profissionais
  FOR UPDATE TO authenticated
  USING (private.can_manage_staff(auth.uid()))
  WITH CHECK (private.can_manage_staff(auth.uid()));
CREATE POLICY "Gestores podem remover profissionais" ON public.profissionais
  FOR DELETE TO authenticated USING (private.can_manage_staff(auth.uid()));

-- eventos
DROP POLICY IF EXISTS "eventos_select" ON public.eventos;
DROP POLICY IF EXISTS "eventos_all_content" ON public.eventos;
CREATE POLICY "eventos_select" ON public.eventos
  FOR SELECT TO anon, authenticated
  USING ((ativo = true) OR private.can_manage_content(auth.uid()));
CREATE POLICY "eventos_all_content" ON public.eventos
  FOR ALL TO authenticated
  USING (private.can_manage_content(auth.uid()))
  WITH CHECK (private.can_manage_content(auth.uid()));

-- posts
DROP POLICY IF EXISTS "posts_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_select_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
DROP POLICY IF EXISTS "posts_no_self_publish" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (private.can_manage_content(auth.uid()));
CREATE POLICY "posts_select_auth" ON public.posts
  FOR SELECT TO authenticated
  USING ((status = 'publicado'::post_status) OR private.can_manage_content(auth.uid()) OR (auth.uid() = autor_id));
CREATE POLICY "posts_update" ON public.posts
  FOR UPDATE TO authenticated
  USING (private.is_school_staff(auth.uid()) OR (auth.uid() = autor_id))
  WITH CHECK (private.is_school_staff(auth.uid()) OR (auth.uid() = autor_id));
CREATE POLICY "posts_delete" ON public.posts
  FOR DELETE TO authenticated
  USING (private.is_school_staff(auth.uid()) OR (auth.uid() = autor_id));
CREATE POLICY "posts_no_self_publish" ON public.posts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (private.is_school_staff(auth.uid()) OR ((status)::text <> 'publicado'::text));

-- push_notifications_queue
DROP POLICY IF EXISTS "push_queue_staff_select" ON public.push_notifications_queue;
DROP POLICY IF EXISTS "push_queue_staff_insert" ON public.push_notifications_queue;
DROP POLICY IF EXISTS "push_queue_staff_update" ON public.push_notifications_queue;
DROP POLICY IF EXISTS "push_queue_staff_delete" ON public.push_notifications_queue;
CREATE POLICY "push_queue_staff_select" ON public.push_notifications_queue
  FOR SELECT TO authenticated USING (private.is_school_staff(auth.uid()));
CREATE POLICY "push_queue_staff_insert" ON public.push_notifications_queue
  FOR INSERT TO authenticated WITH CHECK (private.is_school_staff(auth.uid()));
CREATE POLICY "push_queue_staff_update" ON public.push_notifications_queue
  FOR UPDATE TO authenticated
  USING (private.is_school_staff(auth.uid()))
  WITH CHECK (private.is_school_staff(auth.uid()));
CREATE POLICY "push_queue_staff_delete" ON public.push_notifications_queue
  FOR DELETE TO authenticated USING (private.is_school_staff(auth.uid()));

-- audit_logs
DROP POLICY IF EXISTS "audit_select_desenvolvedor" ON public.audit_logs;
CREATE POLICY "audit_select_desenvolvedor" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'desenvolvedor'::public.app_role));

-- alerts
DROP POLICY IF EXISTS "Gerentes veem todos alertas" ON public.alerts;
DROP POLICY IF EXISTS "Gerentes inserem alertas" ON public.alerts;
DROP POLICY IF EXISTS "Gerentes atualizam alertas" ON public.alerts;
DROP POLICY IF EXISTS "Gerentes excluem alertas" ON public.alerts;
CREATE POLICY "Gerentes veem todos alertas" ON public.alerts
  FOR SELECT TO authenticated USING (private.can_manage_staff(auth.uid()));
CREATE POLICY "Gerentes inserem alertas" ON public.alerts
  FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_staff(auth.uid()) AND (created_by = auth.uid()));
CREATE POLICY "Gerentes atualizam alertas" ON public.alerts
  FOR UPDATE TO authenticated
  USING (private.can_manage_staff(auth.uid()))
  WITH CHECK (private.can_manage_staff(auth.uid()));
CREATE POLICY "Gerentes excluem alertas" ON public.alerts
  FOR DELETE TO authenticated USING (private.can_manage_staff(auth.uid()));

-- chat tables
DROP POLICY IF EXISTS "staff can delete conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "staff can delete message" ON public.chat_messages;
CREATE POLICY "staff can read conversation" ON public.chat_conversations
  FOR SELECT TO authenticated USING (private.is_school_staff(auth.uid()));
CREATE POLICY "staff can delete conversation" ON public.chat_conversations
  FOR DELETE TO authenticated USING (private.is_school_staff(auth.uid()));
CREATE POLICY "staff can read message" ON public.chat_messages
  FOR SELECT TO authenticated USING (private.is_school_staff(auth.uid()));
CREATE POLICY "staff can delete message" ON public.chat_messages
  FOR DELETE TO authenticated USING (private.is_school_staff(auth.uid()));

-- storage.objects (alert-images)
DROP POLICY IF EXISTS "Content staff can upload alert images" ON storage.objects;
DROP POLICY IF EXISTS "Content staff can update alert images" ON storage.objects;
DROP POLICY IF EXISTS "Content staff can delete alert images" ON storage.objects;
CREATE POLICY "Content staff can upload alert images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'alert-images') AND private.can_manage_content(auth.uid()));
CREATE POLICY "Content staff can update alert images" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((bucket_id = 'alert-images') AND private.can_manage_content(auth.uid()))
  WITH CHECK ((bucket_id = 'alert-images') AND private.can_manage_content(auth.uid()));
CREATE POLICY "Content staff can delete alert images" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'alert-images') AND private.can_manage_content(auth.uid()));

-- 4) Drop the now-unreferenced public helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_school_staff(uuid);
DROP FUNCTION IF EXISTS public.can_manage_staff(uuid);
DROP FUNCTION IF EXISTS public.can_manage_content(uuid);

-- 5) Lock down trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.tg_alerts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_posts_enqueue_push() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_push_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
