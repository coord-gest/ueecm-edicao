
-- 1) Enum de status
do $$ begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type public.post_status as enum ('rascunho','em_revisao','publicado','rejeitado');
  end if;
end $$;

-- 2) Colunas em posts
alter table public.posts
  add column if not exists status public.post_status not null default 'rascunho',
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz,
  add column if not exists motivo_rejeicao text;

-- Marcar posts existentes como publicados para não sumirem do blog
update public.posts set status = 'publicado' where status = 'rascunho' and created_at < now();

-- 3) Função can_approve
create or replace function public.can_approve(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('desenvolvedor','diretor','coordenador')
  )
$$;

grant execute on function public.can_approve(uuid) to authenticated;

-- 4) Substituir policies de posts
drop policy if exists "Posts: leitura pública" on public.posts;
drop policy if exists "Posts: criar (equipe)" on public.posts;
drop policy if exists "Posts: editar (equipe)" on public.posts;
drop policy if exists "Posts: excluir (gestão)" on public.posts;

-- Leitura pública: apenas publicados
create policy "Posts: leitura pública publicados"
on public.posts for select
to public
using (status = 'publicado');

-- Equipe autenticada: vê todos
create policy "Posts: equipe vê todos"
on public.posts for select
to authenticated
using (public.is_staff(auth.uid()));

-- Insert: equipe cria
create policy "Posts: equipe cria"
on public.posts for insert
to authenticated
with check (public.is_staff(auth.uid()));

-- Update: autor edita próprio rascunho/rejeitado OU aprovador edita qualquer
create policy "Posts: autor edita rascunho"
on public.posts for update
to authenticated
using (
  (autor_id = auth.uid() and status in ('rascunho','rejeitado'))
  or public.can_approve(auth.uid())
)
with check (
  (autor_id = auth.uid() and status in ('rascunho','em_revisao'))
  or public.can_approve(auth.uid())
);

-- Delete: gestão
create policy "Posts: gestão exclui"
on public.posts for delete
to authenticated
using (public.is_manager(auth.uid()));

-- 5) Bucket de mídia
insert into storage.buckets (id, name, public)
values ('posts-media', 'posts-media', true)
on conflict (id) do nothing;

drop policy if exists "posts-media leitura pública" on storage.objects;
drop policy if exists "posts-media equipe escreve" on storage.objects;
drop policy if exists "posts-media equipe atualiza" on storage.objects;
drop policy if exists "posts-media equipe deleta" on storage.objects;

create policy "posts-media leitura pública"
on storage.objects for select
to public
using (bucket_id = 'posts-media');

create policy "posts-media equipe escreve"
on storage.objects for insert
to authenticated
with check (bucket_id = 'posts-media' and public.is_staff(auth.uid()));

create policy "posts-media equipe atualiza"
on storage.objects for update
to authenticated
using (bucket_id = 'posts-media' and public.is_staff(auth.uid()));

create policy "posts-media equipe deleta"
on storage.objects for delete
to authenticated
using (bucket_id = 'posts-media' and public.is_manager(auth.uid()));
