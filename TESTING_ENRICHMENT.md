# Testing the Enrichment Form

## Prerequisites

✅ Migration 003 is run in Supabase  
✅ Storage bucket `customer-uploads` is created  
✅ Dev server is running (`npm run dev`)

---

## Step 1: Find a Test Order

1. Go to `http://localhost:3002/orders`
2. Filter by status: **"Pending Enrichment"**
3. Pick any order and note its **Order Number** (the number in the first column)
4. Click into that order to see what personalization type it needs

**Don't have any pending orders?**

- Either sync from Etsy (click "🔄 Sync Orders")
- Or manually change an existing order's status to `pending_enrichment`

---

## Step 2: Check Product Configuration

Before testing, verify the product is configured:

1. Go to `http://localhost:3002/settings/products`
2. Find the product that matches your test order's SKU
3. Note the **Personalization Type**:
   - **None** → No form needed (order should auto-advance)
   - **Notes** → Form will show text field only
   - **Image** → Form will show file upload only
   - **Both** → Form will show text field + file upload

**No products configured?**

- Click the modal that appears with unconfigured SKUs
- Or click "➕ Add Product" to create one manually

---

## Step 3: Test the Public Form

### A. Access the Form

Navigate to: `http://localhost:3002/enrich`

### B. Enter Order Number

1. Enter the order number you copied (e.g., `1234567890`)
2. Click **"Continue"**

**Expected Result:**

- ✅ Form loads with customer name and product info
- ✅ Shows correct fields based on personalization type
- ✅ Displays personalization instructions if any

**If you get an error:**

- "Order not found" → Check you entered the correct number
- "Already submitted" → Order is not in `pending_enrichment` status
- "No enrichment needed" → Product type is set to `none`

### C. Fill Out the Form

**Required fields:**

- Email address (any valid email)
- Custom text (if product needs `notes` or `both`)
- Image files (if product needs `image` or `both`)

**Optional:**

- Additional notes

**Test with images:**

- PNG or JPEG only
- Max 10MB per file
- Can upload multiple files

### D. Submit

Click **"Submit"** and wait for confirmation.

**Expected Result:**

- ✅ Success message appears
- ✅ Shows the order number
- ✅ "Submit Another Order" button appears

---

## Step 4: Verify in Admin Dashboard

### A. Check Order Status

1. Go back to `http://localhost:3002/orders`
2. Find your test order
3. **Verify:** Status changed from `pending_enrichment` → `ready_for_design` ✅

### B. Check Order Details

1. Click into the order
2. Scroll down to **"📝 Customer Enrichment"** section

**Verify it shows:**

- ✅ Submitted timestamp
- ✅ Customer email (clickable mailto link)
- ✅ Custom text (if provided)
- ✅ Additional notes (if provided)
- ✅ List of uploaded images with file details

### C. Check Supabase Storage

1. Go to **Supabase Dashboard → Storage → customer-uploads**
2. You should see a folder with the order ID
3. Inside, your uploaded image files

---

## Step 5: Test Edge Cases

### Test 1: Duplicate Submission

Try submitting the same order again (use the same order number).

**Expected:** Error message: "This order has already been submitted..."

### Test 2: Invalid Order Number

Enter a fake order number like `9999999999`.

**Expected:** Error message: "Order not found. Please check your order number."

### Test 3: Product with No Personalization

Find a product configured with `personalization_type: none`, sync an order with that SKU.

**Expected:**

- Order should go directly to `ready_for_design` (skip enrichment)
- If you try to use the form: "This product does not require personalization..."

### Test 4: Missing Required Fields

Try submitting without filling in required fields.

**Expected:**

- HTML5 validation prevents submission
- If product needs text: can't submit without text
- If product needs image: error "At least one image is required"

### Test 5: Large File Upload

Try uploading a file over 10MB.

**Expected:** Error: "File exceeds 10MB limit"

### Test 6: Wrong File Type

Try uploading a PDF or other non-image file.

**Expected:** Error: "File must be PNG or JPEG format"

---

## Troubleshooting

### Form doesn't load

- Check dev server is running
- Check console for errors (F12)
- Check `/api/enrich/lookup` endpoint is accessible

### "Bucket not found" error

- Verify storage bucket is created
- Name must be exactly `customer-uploads`
- Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Files upload but don't appear in order details

- Check Supabase logs for errors
- Verify `custom_images` column exists in orders table
- Check browser console for JSON parsing errors

### Order status doesn't change

- Check API response in Network tab (F12)
- Verify order was in `pending_enrichment` status
- Check server logs for errors

---

## Success Checklist

- ✅ Can look up order by order number
- ✅ Form shows correct fields based on product type
- ✅ Can submit text personalization
- ✅ Can upload image files
- ✅ Order status changes to `ready_for_design`
- ✅ Enrichment data appears in order details
- ✅ Files are stored in Supabase Storage
- ✅ Error handling works (duplicate, invalid order, etc.)

---

## Next Steps

Once testing is complete, you're ready for **Phase 2.2: Flag for Review**!
