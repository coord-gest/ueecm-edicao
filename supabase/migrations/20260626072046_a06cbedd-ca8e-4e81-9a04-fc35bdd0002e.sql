
-- Habilita pgvector e adiciona busca semântica em posts
create extension if not exists vector;

alter table public.posts add column if not exists embedding vector(1536);
alter table public.posts add column if not exists embedding_updated_at timestamptz;

create index if not exists posts_embedding_hnsw_idx
  on public.posts using hnsw (embedding vector_cosine_ops);

create or replace function public.match_posts(
  query_embedding vector(1536),
  match_count int default 5,
  min_similarity float default 0.55
) returns table (
  id uuid,
  titulo text,
  resumo text,
  excerpt text,
  conteudo text,
  categoria text,
  autor_nome text,
  published_at timestamptz,
  slug text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select p.id, p.titulo, p.resumo, p.excerpt, p.conteudo, p.categoria,
         p.autor_nome, p.published_at, p.slug,
         1 - (p.embedding <=> query_embedding) as similarity
  from public.posts p
  where p.status = 'publicado'
    and p.embedding is not null
    and (1 - (p.embedding <=> query_embedding)) >= min_similarity
  order by p.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_posts(vector, int, float) to anon, authenticated, service_role;
