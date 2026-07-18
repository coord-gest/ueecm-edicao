
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('desenvolvedor', 'admin', 'professor', 'aluno');

-- Tabela de papéis
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar papel sem recursão
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Políticas
CREATE POLICY "Usuários veem seus próprios papéis"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'desenvolvedor'));

CREATE POLICY "Desenvolvedores gerenciam papéis"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'desenvolvedor'))
WITH CHECK (public.has_role(auth.uid(), 'desenvolvedor'));

-- Atribui papel de Desenvolvedor ao usuário
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'desenvolvedor'::public.app_role
FROM auth.users
WHERE email = 'franciscodouglas77@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
