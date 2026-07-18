
DROP POLICY IF EXISTS "Public can view alert images" ON storage.objects;
CREATE POLICY "Public can view alert images"
ON storage.objects FOR SELECT
USING (bucket_id = 'alert-images');

DROP POLICY IF EXISTS "Staff can upload alert images" ON storage.objects;
CREATE POLICY "Staff can upload alert images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'alert-images' AND public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update alert images" ON storage.objects;
CREATE POLICY "Staff can update alert images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'alert-images' AND public.can_manage_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete alert images" ON storage.objects;
CREATE POLICY "Staff can delete alert images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'alert-images' AND public.can_manage_staff(auth.uid()));
