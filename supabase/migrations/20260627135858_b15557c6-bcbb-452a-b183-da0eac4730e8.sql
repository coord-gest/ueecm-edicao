
DROP POLICY IF EXISTS "Public read alert images" ON storage.objects;

CREATE POLICY "Authenticated can list alert images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'alert-images');
