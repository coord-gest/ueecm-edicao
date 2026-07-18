-- Cria gatilho para auto-criar profile + role para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Cria profiles retroativamente para usuários que ainda não têm
INSERT INTO public.profiles (user_id, display_name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1)),
       u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Garante role 'leitor' base para qualquer usuário sem nenhuma role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'leitor'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;