INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'franciscodouglas77@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Garantir também o papel de diretor/professor para acesso completo às áreas de staff
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'diretor'::public.app_role
FROM auth.users
WHERE email = 'franciscodouglas77@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;