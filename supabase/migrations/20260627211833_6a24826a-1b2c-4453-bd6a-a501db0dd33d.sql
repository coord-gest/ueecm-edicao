-- Helpers SECURITY DEFINER para quebrar a recursão de RLS
-- entre aluno_responsavel <-> responsaveis.

CREATE OR REPLACE FUNCTION private.is_owner_of_responsavel(_user_id uuid, _responsavel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.responsaveis r
    WHERE r.id = _responsavel_id AND r.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_professor_of_responsavel(_user_id uuid, _responsavel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.aluno_responsavel ar
    JOIN public.alunos a ON a.id = ar.aluno_id
    JOIN public.turmas_escolares t ON t.id = a.turma_id
    WHERE ar.responsavel_id = _responsavel_id
      AND t.professor_responsavel_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_owner_of_responsavel(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_professor_of_responsavel(uuid, uuid) TO authenticated;

-- Substitui as duas policies recursivas.

DROP POLICY IF EXISTS "alres responsavel select" ON public.aluno_responsavel;
CREATE POLICY "alres responsavel select"
ON public.aluno_responsavel
FOR SELECT
TO authenticated
USING (private.is_owner_of_responsavel(auth.uid(), responsavel_id));

DROP POLICY IF EXISTS "responsaveis professor select" ON public.responsaveis;
CREATE POLICY "responsaveis professor select"
ON public.responsaveis
FOR SELECT
TO authenticated
USING (private.is_professor_of_responsavel(auth.uid(), id));