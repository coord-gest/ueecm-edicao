
-- ============ ENUM de cargos ============
create type public.app_role as enum (
  'desenvolvedor','admin','diretor','coordenador','professor','secretario','leitor'
);

-- ============ Tabela: profiles ============
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ Tabela: user_roles ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- ============ Função has_role (security definer) ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('desenvolvedor','admin','diretor','coordenador','professor','secretario')
  )
$$;

create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('desenvolvedor','admin','diretor','coordenador')
  )
$$;

-- ============ Policies: profiles ============
create policy "Próprio perfil: select" on public.profiles
  for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "Próprio perfil: update" on public.profiles
  for update to authenticated using (auth.uid() = user_id);
create policy "Próprio perfil: insert" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

-- ============ Policies: user_roles ============
create policy "Meus roles: select" on public.user_roles
  for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'desenvolvedor'));
create policy "Dev gerencia roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(),'desenvolvedor'))
  with check (public.has_role(auth.uid(),'desenvolvedor'));

-- ============ Tabela: turmas ============
create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.turmas to anon, authenticated;
grant insert, update, delete on public.turmas to authenticated;
grant all on public.turmas to service_role;
alter table public.turmas enable row level security;
create policy "Turmas: leitura pública" on public.turmas for select using (true);
create policy "Turmas: gestão" on public.turmas for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- ============ Tabela: disciplinas ============
create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.disciplinas to anon, authenticated;
grant insert, update, delete on public.disciplinas to authenticated;
grant all on public.disciplinas to service_role;
alter table public.disciplinas enable row level security;
create policy "Disciplinas: leitura pública" on public.disciplinas for select using (true);
create policy "Disciplinas: gestão" on public.disciplinas for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- ============ Tabela: posts ============
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumo text not null,
  conteudo text,
  imagem text,
  autor text not null,
  autor_id uuid references auth.users(id) on delete set null,
  data timestamptz not null default now(),
  turma text,
  disciplina text,
  destaque boolean not null default false,
  geral boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "Posts: leitura pública" on public.posts for select using (true);
create policy "Posts: criar (equipe)" on public.posts for insert to authenticated
  with check (public.is_staff(auth.uid()));
create policy "Posts: editar (equipe)" on public.posts for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Posts: excluir (gestão)" on public.posts for delete to authenticated
  using (public.is_manager(auth.uid()));

-- ============ Tabela: eventos ============
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  local text,
  tipo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.eventos to anon, authenticated;
grant insert, update, delete on public.eventos to authenticated;
grant all on public.eventos to service_role;
alter table public.eventos enable row level security;
create policy "Eventos: leitura pública" on public.eventos for select using (true);
create policy "Eventos: gestão (equipe)" on public.eventos for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ============ Trigger: handle_new_user ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'leitor')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Trigger updated_at ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger set_posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();
create trigger set_eventos_updated_at before update on public.eventos
  for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
