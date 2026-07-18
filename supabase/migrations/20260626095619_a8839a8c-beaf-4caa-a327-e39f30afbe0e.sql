
-- Allow readers of a comunicado to also read its attachments in storage.
-- Path convention: '<comunicado_id>/<file>'
DROP POLICY IF EXISTS "comunicados anexos read" ON storage.objects;

CREATE POLICY "comunicados anexos read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'comunicados-anexos'
  AND (
    public.is_school_admin(auth.uid())
    OR owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.comunicados c
      WHERE c.id::text = split_part(name, '/', 1)
        AND (
          c.autor_id = auth.uid()
          OR (c.tipo = 'turma' AND c.turma_id IS NOT NULL AND public.is_professor_da_turma(auth.uid(), c.turma_id))
          OR (c.tipo = 'turma' AND EXISTS (
                SELECT 1 FROM public.alunos a
                WHERE a.turma_id = c.turma_id
                  AND public.is_responsavel_do_aluno(auth.uid(), a.id)
              ))
          OR (c.tipo = 'individual' AND public.is_responsavel_do_aluno(auth.uid(), c.aluno_id))
        )
    )
  )
);
