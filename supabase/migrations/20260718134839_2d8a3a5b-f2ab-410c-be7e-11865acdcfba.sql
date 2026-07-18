
CREATE POLICY "Fotos da galeria são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'galeria-eventos');

CREATE POLICY "Equipe faz upload de fotos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'galeria-eventos' AND public.is_professor_or_staff(auth.uid()));

CREATE POLICY "Equipe atualiza fotos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'galeria-eventos' AND public.is_professor_or_staff(auth.uid()))
  WITH CHECK (bucket_id = 'galeria-eventos' AND public.is_professor_or_staff(auth.uid()));

CREATE POLICY "Equipe remove fotos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'galeria-eventos' AND public.is_professor_or_staff(auth.uid()));
