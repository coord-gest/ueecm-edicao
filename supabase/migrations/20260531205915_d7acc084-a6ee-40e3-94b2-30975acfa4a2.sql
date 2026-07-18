INSERT INTO public.user_roles (user_id, role)
VALUES ('920d1bbb-2574-4cd2-9b80-90ab028e4f05', 'desenvolvedor')
ON CONFLICT (user_id, role) DO NOTHING;