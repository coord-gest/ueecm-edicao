CREATE TABLE public.post_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_nome text NOT NULL,
  autor_avatar text,
  conteudo text NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  moderado_por uuid REFERENCES auth.users(id),
  moderado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.post_comentarios TO authenticated;
GRANT SELECT ON public.post_comentarios TO anon;
GRANT UPDATE, DELETE ON public.post_comentarios TO authenticated;
GRANT ALL ON public.post_comentarios TO service_role;

ALTER TABLE public.post_comentarios ENABLE ROW LEVEL SECURITY;

-- Qualquer um (anon ou auth) pode ver comentários aprovados
CREATE POLICY "Comentarios aprovados visiveis a todos"
  ON public.post_comentarios FOR SELECT
  USING (status = 'aprovado');

-- Usuário pode ver seus próprios comentários (mesmo pendentes/rejeitados)
CREATE POLICY "Usuario ve seus comentarios"
  ON public.post_comentarios FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff/admin pode ver todos
CREATE POLICY "Staff ve todos comentarios"
  ON public.post_comentarios FOR SELECT
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

-- Usuário autenticado pode criar comentário (sempre como pendente, em seu nome)
CREATE POLICY "Usuario autenticado cria comentario"
  ON public.post_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pendente');

-- Usuário pode deletar seu próprio comentário
CREATE POLICY "Usuario deleta seu comentario"
  ON public.post_comentarios FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin/staff modera (update status) e pode deletar
CREATE POLICY "Staff modera comentarios"
  ON public.post_comentarios FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(auth.uid()));

CREATE POLICY "Staff deleta comentarios"
  ON public.post_comentarios FOR DELETE
  TO authenticated
  USING (public.is_school_admin(auth.uid()));

CREATE INDEX idx_post_comentarios_post ON public.post_comentarios(post_id, status, created_at DESC);
CREATE INDEX idx_post_comentarios_status ON public.post_comentarios(status, created_at DESC);

CREATE TRIGGER trg_post_comentarios_updated_at
  BEFORE UPDATE ON public.post_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();