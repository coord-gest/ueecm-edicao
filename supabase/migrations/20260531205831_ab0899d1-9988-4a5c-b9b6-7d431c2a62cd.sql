CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'desenvolvedor'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('desenvolvedor', 'admin', 'diretor', 'coordenador')
  )
$$;

-- Only the developer can manage roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Developers can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_developer(auth.uid()))
WITH CHECK (public.is_developer(auth.uid()));

CREATE POLICY "Developers can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_developer(auth.uid()));