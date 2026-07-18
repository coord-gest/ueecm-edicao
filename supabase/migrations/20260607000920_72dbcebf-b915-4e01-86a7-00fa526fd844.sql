DROP POLICY IF EXISTS "posts_select_auth" ON public.posts;
DROP POLICY IF EXISTS "posts_update" ON public.posts;
DROP POLICY IF EXISTS "posts_delete" ON public.posts;

ALTER TABLE public.posts ALTER COLUMN autor DROP DEFAULT;
ALTER TABLE public.posts ALTER COLUMN autor TYPE text USING COALESCE(autor::text, '');
UPDATE public.posts SET autor = '' WHERE autor IS NULL;
ALTER TABLE public.posts ALTER COLUMN autor SET NOT NULL;
ALTER TABLE public.posts ALTER COLUMN autor SET DEFAULT '';

UPDATE public.posts SET resumo = '' WHERE resumo IS NULL;
UPDATE public.posts SET data = CURRENT_DATE WHERE data IS NULL;
ALTER TABLE public.posts
  ALTER COLUMN resumo SET NOT NULL,
  ALTER COLUMN resumo SET DEFAULT '',
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN data SET DEFAULT CURRENT_DATE;

CREATE POLICY "posts_select_auth" ON public.posts FOR SELECT TO authenticated
  USING (status = 'publicado'::public.post_status OR public.can_manage_content(auth.uid()) OR auth.uid() = autor_id);
CREATE POLICY "posts_update" ON public.posts FOR UPDATE TO authenticated
  USING (public.is_school_staff(auth.uid()) OR auth.uid() = autor_id)
  WITH CHECK (public.is_school_staff(auth.uid()) OR auth.uid() = autor_id);
CREATE POLICY "posts_delete" ON public.posts FOR DELETE TO authenticated
  USING (public.is_school_staff(auth.uid()) OR auth.uid() = autor_id);

ALTER TABLE public.audit_logs RENAME COLUMN old_data TO before;
ALTER TABLE public.audit_logs RENAME COLUMN new_data TO after;

CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO public.audit_logs (table_name, record_id, action, actor_id, before, after)
  VALUES (TG_TABLE_NAME, v_id, TG_OP, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

ALTER TABLE public.profiles RENAME COLUMN nome TO display_name;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name, email, avatar_url)
  VALUES (
    NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;