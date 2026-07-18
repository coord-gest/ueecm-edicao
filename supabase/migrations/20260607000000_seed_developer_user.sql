-- =============================================================
-- INSTRUÇÕES: Execute este script no SQL Editor do Supabase
-- Dashboard → SQL Editor → New Query → cole e execute.
--
-- Este script NÃO cria a senha — o usuário é criado pelo
-- painel do Supabase (Authentication → Users → Add user).
-- Após criar o usuário lá, copie o UUID gerado e substitua
-- 'COLE_AQUI_O_UUID_DO_USUARIO' abaixo antes de executar.
-- =============================================================

-- 1. Garante que o profile existe para o usuário
INSERT INTO public.profiles (user_id, display_name, email)
VALUES (
  'COLE_AQUI_O_UUID_DO_USUARIO',
  'Francisco Douglas',          -- troque pelo nome desejado
  'seu@email.com'               -- troque pelo e-mail real
)
ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      email        = EXCLUDED.email;

-- 2. Remove qualquer role anterior (ex: leitor criado pelo trigger)
DELETE FROM public.user_roles
WHERE user_id = 'COLE_AQUI_O_UUID_DO_USUARIO';

-- 3. Atribui o papel de desenvolvedor
INSERT INTO public.user_roles (user_id, role)
VALUES ('COLE_AQUI_O_UUID_DO_USUARIO', 'desenvolvedor');
