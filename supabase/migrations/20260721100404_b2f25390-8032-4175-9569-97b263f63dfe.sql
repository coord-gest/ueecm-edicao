
-- Função auxiliar: responsável tem filho em uma turma?
CREATE OR REPLACE FUNCTION public.is_responsavel_da_turma(_user_id uuid, _turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.aluno_responsavel ar
    JOIN public.responsaveis r ON r.id = ar.responsavel_id
    JOIN public.alunos a ON a.id = ar.aluno_id
    WHERE r.user_id = _user_id AND a.turma_id = _turma_id AND a.ativo IS TRUE
  );
$$;

-- Responsáveis podem ver as atividades das turmas dos filhos
CREATE POLICY "Responsavel ve atividades das turmas dos filhos"
  ON public.atividades FOR SELECT
  TO authenticated
  USING (public.is_responsavel_da_turma(auth.uid(), turma_id));

-- Responsáveis podem ver as entregas dos próprios filhos
CREATE POLICY "Responsavel ve entregas dos filhos"
  ON public.atividade_entregas FOR SELECT
  TO authenticated
  USING (public.is_responsavel_do_aluno(auth.uid(), aluno_id));
