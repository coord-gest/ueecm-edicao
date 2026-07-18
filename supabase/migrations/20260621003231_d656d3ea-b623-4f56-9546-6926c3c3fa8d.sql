
-- Grants ausentes: tornar horarios/turmas/disciplinas acessíveis via Data API
GRANT SELECT ON public.horarios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios TO authenticated;
GRANT ALL ON public.horarios TO service_role;

GRANT SELECT ON public.turmas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated;
GRANT ALL ON public.turmas TO service_role;

GRANT SELECT ON public.disciplinas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinas TO authenticated;
GRANT ALL ON public.disciplinas TO service_role;

-- Restringir edição apenas a Desenvolvedor, Diretor e Coordenador (can_manage_staff)
DROP POLICY IF EXISTS horarios_all_staff ON public.horarios;
CREATE POLICY horarios_manage ON public.horarios
  FOR ALL TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS turmas_all_staff ON public.turmas;
CREATE POLICY turmas_manage ON public.turmas
  FOR ALL TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS disciplinas_all_staff ON public.disciplinas;
CREATE POLICY disciplinas_manage ON public.disciplinas
  FOR ALL TO authenticated
  USING (public.can_manage_staff(auth.uid()))
  WITH CHECK (public.can_manage_staff(auth.uid()));

-- Ajustar SELECT públicos para incluir gestores que possam ver registros inativos
DROP POLICY IF EXISTS horarios_select ON public.horarios;
CREATE POLICY horarios_select ON public.horarios
  FOR SELECT TO anon, authenticated
  USING ((ativo = true) OR public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS turmas_select ON public.turmas;
CREATE POLICY turmas_select ON public.turmas
  FOR SELECT TO anon, authenticated
  USING ((ativo = true) OR public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS disciplinas_select ON public.disciplinas;
CREATE POLICY disciplinas_select ON public.disciplinas
  FOR SELECT TO anon, authenticated
  USING ((ativo = true) OR public.can_manage_staff(auth.uid()));
