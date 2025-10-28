-- Enable RLS on storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to upload files to design-files bucket
CREATE POLICY "Allow public uploads to design-files"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'design-files');

-- Policy: Allow public read access to design-files bucket (for previews)
CREATE POLICY "Allow public read access to design-files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'design-files');

-- Policy: Allow users to update their own uploads (for replace functionality)
CREATE POLICY "Allow public updates to design-files"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'design-files')
WITH CHECK (bucket_id = 'design-files');

-- Policy: Allow public delete (for cleanup when orders are deleted)
CREATE POLICY "Allow public delete from design-files"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'design-files');

