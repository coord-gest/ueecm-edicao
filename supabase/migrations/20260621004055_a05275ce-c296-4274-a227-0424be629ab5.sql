GRANT SELECT ON TABLE public.horarios TO anon;
GRANT SELECT ON TABLE public.turmas TO anon;
GRANT SELECT ON TABLE public.disciplinas TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.horarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.turmas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.disciplinas TO authenticated;

GRANT ALL ON TABLE public.horarios TO service_role;
GRANT ALL ON TABLE public.turmas TO service_role;
GRANT ALL ON TABLE public.disciplinas TO service_role;

DROP POLICY IF EXISTS horarios_select ON public.horarios;
CREATE POLICY horarios_select
ON public.horarios
FOR SELECT
TO anon, authenticated
USING (ativo IS TRUE OR public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS turmas_select ON public.turmas;
CREATE POLICY turmas_select
ON public.turmas
FOR SELECT
TO anon, authenticated
USING (ativo IS TRUE OR public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS disciplinas_select ON public.disciplinas;
CREATE POLICY disciplinas_select
ON public.disciplinas
FOR SELECT
TO anon, authenticated
USING (ativo IS TRUE OR public.can_manage_staff(auth.uid()));