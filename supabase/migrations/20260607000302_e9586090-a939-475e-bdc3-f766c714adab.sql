-- Add new roles (safe even if pre-existing). Cannot USE these literals in same migration, so we compare via ::text.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretario';

DO $$ BEGIN
  CREATE TYPE public.post_status AS ENUM ('rascunho','em_revisao','publicado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.is_school_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('desenvolvedor','admin','diretor','coordenador','secretario')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_content(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('desenvolvedor','admin','diretor','coordenador','secretario','professor')
  )
$$;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  email text,
  telefone text,
  avatar_url text,
  matricula text,
  cargo text,
  bio text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR public.is_school_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_school_staff(auth.uid())) WITH CHECK (auth.uid() = id OR public.is_school_staff(auth.uid()));
CREATE POLICY "profiles_delete_staff" ON public.profiles FOR DELETE TO authenticated USING (public.is_school_staff(auth.uid()));
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- turmas
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  ano integer,
  serie text,
  turno text,
  professor text,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.turmas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated;
GRANT ALL ON public.turmas TO service_role;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "turmas_select" ON public.turmas FOR SELECT TO anon, authenticated USING (ativo = true OR public.is_school_staff(auth.uid()));
CREATE POLICY "turmas_all_staff" ON public.turmas FOR ALL TO authenticated USING (public.is_school_staff(auth.uid())) WITH CHECK (public.is_school_staff(auth.uid()));
CREATE TRIGGER set_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- disciplinas
CREATE TABLE public.disciplinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  codigo text,
  categoria text,
  professor text,
  turma text,
  turno text,
  descricao text,
  resumo text,
  cor text,
  ordem integer NOT NULL DEFAULT 0,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disciplinas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinas TO authenticated;
GRANT ALL ON public.disciplinas TO service_role;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplinas_select" ON public.disciplinas FOR SELECT TO anon, authenticated USING (ativo = true OR public.is_school_staff(auth.uid()));
CREATE POLICY "disciplinas_all_staff" ON public.disciplinas FOR ALL TO authenticated USING (public.is_school_staff(auth.uid())) WITH CHECK (public.is_school_staff(auth.uid()));
CREATE TRIGGER set_disciplinas_updated_at BEFORE UPDATE ON public.disciplinas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- horarios
CREATE TABLE public.horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text,
  turma text,
  disciplina text,
  professor text,
  dia_semana integer,
  horario text,
  horas time,
  horas_fim time,
  turno text,
  tipo text,
  cor text,
  local text,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.horarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios TO authenticated;
GRANT ALL ON public.horarios TO service_role;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "horarios_select" ON public.horarios FOR SELECT TO anon, authenticated USING (ativo = true OR public.is_school_staff(auth.uid()));
CREATE POLICY "horarios_all_staff" ON public.horarios FOR ALL TO authenticated USING (public.is_school_staff(auth.uid())) WITH CHECK (public.is_school_staff(auth.uid()));
CREATE TRIGGER set_horarios_updated_at BEFORE UPDATE ON public.horarios FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- eventos
CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  slug text UNIQUE,
  descricao text,
  data date,
  data_inicio timestamptz,
  data_fim timestamptz,
  horario text,
  local text,
  categoria text,
  tipo text,
  cor text,
  turma text,
  disciplina text,
  professor text,
  destaque boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.eventos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_select" ON public.eventos FOR SELECT TO anon, authenticated USING (ativo = true OR public.can_manage_content(auth.uid()));
CREATE POLICY "eventos_all_content" ON public.eventos FOR ALL TO authenticated USING (public.can_manage_content(auth.uid())) WITH CHECK (public.can_manage_content(auth.uid()));
CREATE TRIGGER set_eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  slug text UNIQUE,
  conteudo text,
  resumo text,
  excerpt text,
  categoria text,
  tags text[] NOT NULL DEFAULT '{}',
  status public.post_status NOT NULL DEFAULT 'rascunho',
  autor uuid,
  autor_id uuid,
  autor_nome text,
  imagem_url text,
  motivo_rejeicao text,
  turma text,
  disciplina text,
  data date,
  destaque boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_published" ON public.posts FOR SELECT TO anon USING (status = 'publicado'::public.post_status);
CREATE POLICY "posts_select_auth" ON public.posts FOR SELECT TO authenticated USING (status = 'publicado'::public.post_status OR public.can_manage_content(auth.uid()) OR auth.uid() = autor OR auth.uid() = autor_id);
CREATE POLICY "posts_insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (public.can_manage_content(auth.uid()));
CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated USING (public.is_school_staff(auth.uid()) OR auth.uid() = autor OR auth.uid() = autor_id) WITH CHECK (public.is_school_staff(auth.uid()) OR auth.uid() = autor OR auth.uid() = autor_id);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated USING (public.is_school_staff(auth.uid()) OR auth.uid() = autor OR auth.uid() = autor_id);
CREATE TRIGGER set_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid,
  acao text NOT NULL,
  usuario_id uuid,
  usuario_email text,
  dados_antigos jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_staff" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid()));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE TRIGGER set_audit_logs_updated_at BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO public.audit_logs (tabela, registro_id, acao, usuario_id, dados_antigos, dados_novos)
  VALUES (TG_TABLE_NAME, v_id, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_turmas AFTER INSERT OR UPDATE OR DELETE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_disciplinas AFTER INSERT OR UPDATE OR DELETE ON public.disciplinas FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_horarios AFTER INSERT OR UPDATE OR DELETE ON public.horarios FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_eventos AFTER INSERT OR UPDATE OR DELETE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();
CREATE TRIGGER audit_posts AFTER INSERT OR UPDATE OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log();

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.turmas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disciplinas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;