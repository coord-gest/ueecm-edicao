
DROP POLICY IF EXISTS mural_reacoes_select ON public.mural_reacoes;
CREATE POLICY mural_reacoes_select
ON public.mural_reacoes
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.is_school_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.mural_posts p
    WHERE p.id = mural_reacoes.post_id
      AND (p.aprovado = true OR p.autor_id = auth.uid())
  )
);

DROP POLICY IF EXISTS contrib_select_autenticados ON public.vaquinha_contribuicoes;
CREATE POLICY contrib_select_own_or_creator_or_staff
ON public.vaquinha_contribuicoes
FOR SELECT
TO authenticated
USING (
  contribuinte_user_id = auth.uid()
  OR public.is_apoio_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.vaquinhas v
    WHERE v.id = vaquinha_contribuicoes.vaquinha_id
      AND v.criado_por = auth.uid()
  )
);
