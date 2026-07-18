-- Restaurar policy original que permite o solicitante ver o próprio agendamento.
DROP POLICY IF EXISTS "Staff ve todos os agendamentos" ON public.agendamentos;

CREATE POLICY "Usuario ve seus agendamentos"
  ON public.agendamentos
  FOR SELECT
  TO authenticated
  USING (
    (solicitante_user_id = auth.uid()) OR is_school_admin(auth.uid())
  );

-- Remover a view auxiliar (não é mais necessária).
DROP VIEW IF EXISTS public.meus_agendamentos;
