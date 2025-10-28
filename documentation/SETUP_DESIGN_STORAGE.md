# Design Files Storage Setup

This document explains how to set up Supabase Storage for design file uploads.

## 1. Create Storage Bucket

In your Supabase Dashboard:

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Enter the following settings:

   - **Name**: `design-files`
   - **Public**: ✅ **Yes** (Check this box)
   - **File size limit**: 50 MB (or as needed)
   - **Allowed MIME types**: `application/pdf`

4. Click **"Create bucket"**

## 2. Configure Bucket Policies

After creating the bucket, set up access policies:

### Option A: Allow All (for development)

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'design-files');

-- Allow anyone to read files (since bucket is public)
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'design-files');

-- Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'design-files');
```

### Option B: Service Role Only (recommended for production)

Since we're using `supabaseAdmin` (service role), no additional policies are needed. The service role bypasses RLS.

Just ensure your API routes use `supabaseAdmin` for all storage operations.

## 3. Verify Setup

To verify your bucket is set up correctly:

```javascript
// Test upload (run in your API route or test script)
const { data, error } = await supabaseAdmin.storage
  .from("design-files")
  .upload("test/test.pdf", buffer);

if (error) {
  console.error("Storage error:", error);
} else {
  console.log("Upload successful!", data);
}
```

## 4. File Structure

Design files will be organized as:

```
design-files/
  ├── {order_id}/
  │   ├── {transaction_id}_{timestamp}.pdf
  │   ├── {transaction_id}_{timestamp}.pdf
  │   └── ...
  ├── {order_id}/
  │   └── ...
```

## 5. Accessing Files

Files can be accessed via public URLs:

```
https://{project-ref}.supabase.co/storage/v1/object/public/design-files/{order_id}/{transaction_id}_{timestamp}.pdf
```

## Troubleshooting

### Upload fails with 403 error

- Check that the bucket is set to public
- Verify you're using `supabaseAdmin` (service role) in your API

### Files don't appear in bucket

- Check browser console for errors
- Verify file size is under the bucket limit
- Ensure MIME type is `application/pdf`

### Can't access files via URL

- Confirm bucket is set to **Public**
- Check the URL format matches the pattern above
