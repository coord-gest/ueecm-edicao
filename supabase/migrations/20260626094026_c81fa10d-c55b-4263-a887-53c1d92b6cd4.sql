
-- RLS para storage.objects no bucket comunicados-anexos
CREATE POLICY "comunicados anexos upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comunicados-anexos' AND (
      public.is_school_admin(auth.uid()) OR
      EXISTS (SELECT 1 FROM public.turmas_escolares t WHERE t.professor_responsavel_id = auth.uid())
    )
  );

CREATE POLICY "comunicados anexos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comunicados-anexos' AND (
      public.is_school_admin(auth.uid()) OR
      owner = auth.uid()
    )
  );

CREATE POLICY "comunicados anexos delete owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comunicados-anexos' AND (owner = auth.uid() OR public.is_school_admin(auth.uid()))
  );
