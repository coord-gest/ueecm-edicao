DROP POLICY IF EXISTS "Staff can upload alert images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update alert images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete alert images" ON storage.objects;

CREATE POLICY "Content staff can upload alert images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'alert-images'
  AND public.can_manage_content(auth.uid())
);

CREATE POLICY "Content staff can update alert images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'alert-images'
  AND public.can_manage_content(auth.uid())
)
WITH CHECK (
  bucket_id = 'alert-images'
  AND public.can_manage_content(auth.uid())
);

CREATE POLICY "Content staff can delete alert images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'alert-images'
  AND public.can_manage_content(auth.uid())
);