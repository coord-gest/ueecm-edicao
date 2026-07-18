
-- Garante search_path nas funções
alter function public.set_updated_at() set search_path = public;

-- Revoga execução pública das funções definer (continuam usáveis internamente por RLS/triggers)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.is_staff(uuid) from public, anon, authenticated;
revoke execute on function public.is_manager(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
