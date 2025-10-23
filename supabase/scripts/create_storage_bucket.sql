-- Create Private Storage Bucket for Customer Uploads
-- Run this in Supabase SQL Editor

-- Create the bucket as PRIVATE (not public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-uploads',
  'customer-uploads',
  false,  -- PRIVATE bucket for security
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
);

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'customer-uploads';

-- Note: No storage policies needed!
-- Since we use service role key server-side, we have full access to private buckets.
-- This is more secure than a public bucket.

