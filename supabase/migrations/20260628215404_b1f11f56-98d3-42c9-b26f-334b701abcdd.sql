CREATE INDEX IF NOT EXISTS idx_posts_status_published_at ON public.posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_autor_id ON public.posts (autor_id);
CREATE INDEX IF NOT EXISTS idx_posts_categoria ON public.posts (categoria);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts (slug);

CREATE INDEX IF NOT EXISTS idx_comunicados_turma_id ON public.comunicados (turma_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_autor_id ON public.comunicados (autor_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_created_at ON public.comunicados (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alunos_turma_id ON public.alunos (turma_id);
CREATE INDEX IF NOT EXISTS idx_alunos_nome_lower ON public.alunos (lower(nome_completo));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS idx_post_comentarios_post_status ON public.post_comentarios (post_id, status);
CREATE INDEX IF NOT EXISTS idx_post_comentarios_status ON public.post_comentarios (status);
