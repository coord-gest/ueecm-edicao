-- 1. Trigger handle_new_user em auth.users (cria profile + role leitor)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles para usuários existentes
INSERT INTO public.profiles (user_id, display_name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)),
       u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 3. Backfill role leitor para usuários sem role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'leitor'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL;

-- 4. Triggers set_updated_at
DROP TRIGGER IF EXISTS set_updated_at_posts ON public.posts;
CREATE TRIGGER set_updated_at_posts
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_eventos ON public.eventos;
CREATE TRIGGER set_updated_at_eventos
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Triggers de audit nas tabelas principais (caso ainda não estejam)
DROP TRIGGER IF EXISTS audit_posts ON public.posts;
CREATE TRIGGER audit_posts
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_turmas ON public.turmas;
CREATE TRIGGER audit_turmas
  AFTER INSERT OR UPDATE OR DELETE ON public.turmas
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_disciplinas ON public.disciplinas;
CREATE TRIGGER audit_disciplinas
  AFTER INSERT OR UPDATE OR DELETE ON public.disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_horarios ON public.horarios;
CREATE TRIGGER audit_horarios
  AFTER INSERT OR UPDATE OR DELETE ON public.horarios
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_eventos ON public.eventos;
CREATE TRIGGER audit_eventos
  AFTER INSERT OR UPDATE OR DELETE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- 6. Foreign Keys faltantes
-- Limpa horarios órfãos antes de criar FK
DELETE FROM public.horarios WHERE turma_id NOT IN (SELECT id FROM public.turmas);
DELETE FROM public.horarios WHERE disciplina_id NOT IN (SELECT id FROM public.disciplinas);

ALTER TABLE public.horarios
  DROP CONSTRAINT IF EXISTS horarios_turma_id_fkey,
  ADD CONSTRAINT horarios_turma_id_fkey
    FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

ALTER TABLE public.horarios
  DROP CONSTRAINT IF EXISTS horarios_disciplina_id_fkey,
  ADD CONSTRAINT horarios_disciplina_id_fkey
    FOREIGN KEY (disciplina_id) REFERENCES public.disciplinas(id) ON DELETE RESTRICT;

-- FK posts.autor_id -> profiles.user_id (nullable, SET NULL on delete)
-- Garante profiles.user_id é UNIQUE para servir como destino de FK
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_key,
  ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

UPDATE public.posts SET autor_id = NULL
  WHERE autor_id IS NOT NULL
    AND autor_id NOT IN (SELECT user_id FROM public.profiles);

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_autor_id_fkey,
  ADD CONSTRAINT posts_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_posts_status_data ON public.posts(status, data DESC);
CREATE INDEX IF NOT EXISTS idx_posts_destaque ON public.posts(destaque) WHERE destaque = true;
CREATE INDEX IF NOT EXISTS idx_posts_autor_id ON public.posts(autor_id);
CREATE INDEX IF NOT EXISTS idx_horarios_turma ON public.horarios(turma_id, dia_semana, ordem);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON public.eventos(data_inicio);