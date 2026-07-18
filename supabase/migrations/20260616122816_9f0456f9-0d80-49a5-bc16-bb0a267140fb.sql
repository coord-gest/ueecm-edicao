DROP POLICY IF EXISTS "Alert images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload alert images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update alert images" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete alert images" ON storage.objects;

CREATE POLICY "Alert images are publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'alert-images');

CREATE POLICY "Staff can upload alert images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'alert-images'
  AND public.can_manage_staff(auth.uid())
);

CREATE POLICY "Staff can update alert images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'alert-images'
  AND public.can_manage_staff(auth.uid())
)
WITH CHECK (
  bucket_id = 'alert-images'
  AND public.can_manage_staff(auth.uid())
);

CREATE POLICY "Staff can delete alert images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'alert-images'
  AND public.can_manage_staff(auth.uid())
);