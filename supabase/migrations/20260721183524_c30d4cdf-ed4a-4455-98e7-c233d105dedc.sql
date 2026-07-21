
-- MURAL POSTS
CREATE TABLE IF NOT EXISTS public.mural_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome text NOT NULL,
  autor_papel text NOT NULL DEFAULT 'familia',
  categoria text NOT NULL CHECK (categoria IN ('conquista','duvida','oferta_ajuda','bastidor','aniversario','receita','projeto')),
  titulo text NOT NULL CHECK (length(titulo) BETWEEN 3 AND 140),
  conteudo text NOT NULL CHECK (length(conteudo) BETWEEN 5 AND 4000),
  imagem_url text,
  aprovado boolean NOT NULL DEFAULT false,
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  fixado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mural_posts_created ON public.mural_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_posts_aprovado ON public.mural_posts (aprovado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_posts_autor ON public.mural_posts (autor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_posts TO authenticated;
GRANT ALL ON public.mural_posts TO service_role;
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mural_posts_select" ON public.mural_posts FOR SELECT TO authenticated
  USING (aprovado = true OR autor_id = auth.uid() OR private.is_school_staff(auth.uid()));
CREATE POLICY "mural_posts_insert_own" ON public.mural_posts FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid());
CREATE POLICY "mural_posts_update" ON public.mural_posts FOR UPDATE TO authenticated
  USING ((autor_id = auth.uid() AND aprovado = false) OR private.is_school_staff(auth.uid()))
  WITH CHECK ((autor_id = auth.uid() AND aprovado = false) OR private.is_school_staff(auth.uid()));
CREATE POLICY "mural_posts_delete" ON public.mural_posts FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR private.is_school_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.mural_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_mural_posts_updated BEFORE UPDATE ON public.mural_posts
  FOR EACH ROW EXECUTE FUNCTION public.mural_touch_updated_at();

-- REACOES
CREATE TABLE IF NOT EXISTS public.mural_reacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('aplauso','coracao','festa','ideia')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_mural_reacoes_post ON public.mural_reacoes (post_id);
GRANT SELECT, INSERT, DELETE ON public.mural_reacoes TO authenticated;
GRANT ALL ON public.mural_reacoes TO service_role;
ALTER TABLE public.mural_reacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mural_reacoes_select" ON public.mural_reacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "mural_reacoes_insert_own" ON public.mural_reacoes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "mural_reacoes_delete_own" ON public.mural_reacoes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- COMENTARIOS
CREATE TABLE IF NOT EXISTS public.mural_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome text NOT NULL,
  conteudo text NOT NULL CHECK (length(conteudo) BETWEEN 1 AND 1000),
  oculto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mural_coment_post ON public.mural_comentarios (post_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mural_comentarios TO authenticated;
GRANT ALL ON public.mural_comentarios TO service_role;
ALTER TABLE public.mural_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mural_coment_select" ON public.mural_comentarios FOR SELECT TO authenticated
  USING (oculto = false OR user_id = auth.uid() OR private.is_school_staff(auth.uid()));
CREATE POLICY "mural_coment_insert_own" ON public.mural_comentarios FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mural_coment_update_moderar" ON public.mural_comentarios FOR UPDATE TO authenticated
  USING (private.is_school_staff(auth.uid())) WITH CHECK (true);
CREATE POLICY "mural_coment_delete_own_or_mod" ON public.mural_comentarios FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_school_staff(auth.uid()));

-- Feed
CREATE OR REPLACE FUNCTION public.mural_listar_feed(_limite int DEFAULT 30, _offset int DEFAULT 0, _categoria text DEFAULT NULL)
RETURNS TABLE (
  id uuid, autor_id uuid, autor_nome text, autor_papel text, categoria text,
  titulo text, conteudo text, imagem_url text, fixado boolean, aprovado boolean,
  created_at timestamptz, total_reacoes bigint, total_comentarios bigint, minhas_reacoes text[]
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.autor_id, p.autor_nome, p.autor_papel, p.categoria, p.titulo, p.conteudo,
    p.imagem_url, p.fixado, p.aprovado, p.created_at,
    COALESCE((SELECT COUNT(*) FROM public.mural_reacoes r WHERE r.post_id = p.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.mural_comentarios c WHERE c.post_id = p.id AND c.oculto = false), 0),
    COALESCE((SELECT array_agg(r.tipo) FROM public.mural_reacoes r WHERE r.post_id = p.id AND r.user_id = auth.uid()), ARRAY[]::text[])
  FROM public.mural_posts p
  WHERE (_categoria IS NULL OR p.categoria = _categoria)
  ORDER BY p.fixado DESC, p.created_at DESC
  LIMIT GREATEST(_limite, 1) OFFSET GREATEST(_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.mural_listar_feed(int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mural_listar_feed(int, int, text) TO authenticated;
