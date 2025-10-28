# Setup: Supabase Storage for Customer Uploads

## Overview

The public enrichment form allows customers to upload images for their custom orders. These files are stored in Supabase Storage with proper access controls.

---

## Step 1: Run Database Migration

First, add the new fields to the orders table:

```bash
cd /Users/momo/Developer/etsy-saas
cat supabase/migrations/003_add_enrichment_fields.sql
```

Copy the SQL and run it in your **Supabase Dashboard → SQL Editor**.

This adds:

- `custom_images` - JSONB array to store uploaded file metadata
- `customer_notes` - Text field for additional instructions
- `enrichment_email` - Customer email from enrichment form
- `enrichment_submitted_at` - Timestamp when enrichment was submitted

---

## Step 2: Create Storage Bucket

1. Go to **Supabase Dashboard → Storage**
2. Click **"New bucket"**
3. Configure the bucket:

   - **Name:** `customer-uploads`
   - **Public bucket:** ❌ **No** (Keep private for security)
   - **File size limit:** 10 MB
   - **Allowed MIME types:** `image/png, image/jpeg`

4. Click **"Create bucket"**

---

## Step 3: Set Storage Policies

The bucket needs to be private (not publicly accessible), but our service role key will have full access.

By default, with no policies and using the service role key (`supabaseAdmin`), the API can:

- ✅ Upload files
- ✅ Read files
- ✅ Delete files

**No additional policies needed!** The service role bypasses RLS.

---

## Step 4: Test the Enrichment Form

### A. Find a Test Order

1. Go to your **Orders** page
2. Find an order with status `pending_enrichment`
3. Note the order number (Etsy Receipt ID)

### B. Access the Public Form

1. Navigate to: `http://localhost:3002/enrich`
2. Enter the order number
3. Fill out the form:
   - Email address
   - Custom text (if required)
   - Upload images (if required)
4. Submit

### C. Verify Submission

1. Go back to your **Orders** page
2. The order should now have status `ready_for_design`
3. Click into the order details
4. You should see:
   - Enrichment email
   - Customer notes (if provided)
   - Uploaded images in `custom_images` field

### D. Verify Storage

1. Go to **Supabase Dashboard → Storage → customer-uploads**
2. You should see a folder with the order ID
3. Inside, you'll find the uploaded image files

---

## How It Works

### File Organization

Files are stored in a structured path:

```
customer-uploads/
  ├── {order_id}/
  │   ├── {timestamp}_filename1.png
  │   ├── {timestamp}_filename2.jpg
  │   └── ...
```

### File Metadata

Uploaded files are tracked in the `orders.custom_images` JSONB field:

```json
[
  {
    "fileName": "my-design.png",
    "filePath": "123/1234567890_my-design.png",
    "fileSize": 2048576,
    "fileType": "image/png",
    "uploadedAt": "2025-10-28T12:00:00.000Z"
  }
]
```

### Access Control

- **Public access:** ❌ Disabled (bucket is private)
- **Service role:** ✅ Full access (API uses `supabaseAdmin`)
- **Customers:** Can only upload during form submission (via API)
- **Internal staff:** Can view files via API/dashboard

### Future: Generating Signed URLs

When you need to display images to staff (e.g., in order details):

```javascript
const { data } = await supabaseAdmin.storage
  .from("customer-uploads")
  .createSignedUrl(filePath, 3600); // 1 hour expiry

const imageUrl = data.signedUrl;
```

---

## Validation & Security

### File Validation (API)

- ✅ File type: PNG, JPEG only
- ✅ File size: Max 10MB per file
- ✅ Required: Based on product `personalization_type`
- ✅ Order validation: Must exist and be in `pending_enrichment` status

### Rate Limiting

**TODO for production:**

- Add rate limiting to prevent spam submissions
- Consider Cloudflare Turnstile or reCAPTCHA
- Track submissions by IP address

---

## Troubleshooting

### Error: "Bucket not found"

- Make sure you created the bucket named **exactly** `customer-uploads`
- Check your Supabase project is correctly configured in `.env.local`

### Error: "Failed to upload"

- Verify your `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Check the bucket exists and is accessible
- View Supabase logs for detailed error messages

### Files Upload but Not Visible

- The bucket should be **private** (not public)
- Files are accessible via service role key
- To view files, use signed URLs or access through dashboard

---

## Next Steps

✅ **Phase 2.1 Complete:** Public enrichment form with file upload

**Phase 2.2:** Flag for Review Feature

- UI to flag orders with issues
- Review dashboard for admins
- Asset replacement capability

**Phase 3:** Design Workflow

- Canva API integration
- Design queue for VAs
- Metadata image generation
