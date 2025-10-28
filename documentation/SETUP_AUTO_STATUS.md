# Setup Automatic Status Promotion

This guide walks you through setting up automatic order status promotion based on product personalization requirements.

## What This Does

Orders will automatically be promoted from `pending_enrichment` to `enriched` if:

1. **Product requires no personalization** - Order is immediately ready for design
2. **Product requires notes only** AND **order already has personalization data** - Order doesn't need enrichment form

## Setup Steps

### Step 1: Run Database Migration

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste this SQL:

```sql
-- Add personalization configuration to product_templates table
ALTER TABLE product_templates
ADD COLUMN IF NOT EXISTS personalization_type VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS personalization_notes TEXT;

COMMENT ON COLUMN product_templates.personalization_type IS 'Type of personalization: none, notes, image, or both';
COMMENT ON COLUMN product_templates.personalization_notes IS 'Instructions or description for the personalization field';
```

4. Click **Run**

### Step 2: Configure Your Products

1. Log in to your app as an admin
2. Go to **Settings → Products**
3. You should see a yellow alert if there are unconfigured SKUs
4. Click **"Configure Now"**
5. For each product:
   - Click **"Configure"**
   - Set **Personalization Type**:
     - `No Personalization` - Product needs no customization
     - `Text/Notes Only` - Customer provides text (name, number, etc.)
     - `Image Upload Only` - Customer uploads an image
     - `Text + Image` - Customer provides both
   - Fill in other details (dimensions, SLA, etc.)
   - Click **"Create Product"**

### Step 3: Run Retroactive Update

1. On the **Products** page, click **"🔄 Update Order Statuses"** (purple button)
2. Confirm the action
3. Wait for the update to complete
4. You'll see a success message showing how many orders were promoted

### Step 4: Verify Results

1. Go to **Orders** page
2. Filter by status `enriched`
3. You should see orders that previously were `pending_enrichment` but already had the required data

## How It Works

### For New Orders (Automatic)

When orders are synced from Etsy:

1. System checks if product exists in `product_templates`
2. Reads the `personalization_type` setting
3. Checks if order has personalization data in `raw_order_data.transactions[0].variations`
4. Sets appropriate initial status:
   - `enriched` if no enrichment needed
   - `pending_enrichment` if enrichment form required

### For Existing Orders (Manual)

Use the **"🔄 Update Order Statuses"** button to apply the logic retroactively:

1. Finds all orders with status `pending_enrichment`
2. For each order:
   - Looks up product configuration by SKU
   - Checks personalization requirements
   - Checks if order has personalization data
   - Updates status to `enriched` if criteria met
3. Shows summary of updated orders

## Personalization Type Logic

| Product Type | Order Has Data | Result                                   |
| ------------ | -------------- | ---------------------------------------- |
| `none`       | N/A            | `enriched` (skip enrichment)             |
| `notes`      | ✅ Yes         | `enriched` (skip enrichment)             |
| `notes`      | ❌ No          | `pending_enrichment` (needs form)        |
| `image`      | Any            | `pending_enrichment` (always needs form) |
| `both`       | Any            | `pending_enrichment` (always needs form) |

## Troubleshooting

### Orders Not Being Promoted

**Check 1: Product Configuration**

- Go to **Settings → Products**
- Verify the product has `personalization_type` set to `none` or `notes`

**Check 2: Order Has Personalization Data**

- Open order details
- Look at the "Personalization" field
- It should NOT say "Not requested on this item"
- It should have actual text/data

**Check 3: SKU Matches**

- Order's `product_sku` must exactly match the product template's `sku`
- Check for typos, case sensitivity, extra spaces

### Button Doesn't Work

- Check browser console for errors (F12 → Console)
- Verify you're logged in as an admin
- Try refreshing the page

### Migration Already Ran Error

If you get "column already exists" error when running the migration:

```sql
-- Check if columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'product_templates'
  AND column_name IN ('personalization_type', 'personalization_notes');
```

If they exist, you're good to go! Skip to Step 2.

## Example Workflow

### Scenario: Fleece Blanket with Name and Number

1. **Product Configuration:**

   - SKU: `BLANKET-10X10`
   - Product Name: `10x10 Fleece Blanket`
   - Personalization Type: `Text/Notes Only`
   - Personalization Notes: `Customer provides name and number (0-99)`

2. **Order from Etsy:**

   - Has personalization: `"Ella" and "7"`
   - Status on import: `enriched` ✅ (automatically promoted)
   - Reason: Product only needs text, order has text

3. **Order from Etsy (No Personalization):**
   - Personalization: Empty or "Not requested"
   - Status on import: `pending_enrichment` ⏳
   - Reason: Product needs text but order missing it
   - Action: Customer needs to fill enrichment form

## Next Steps

After setting this up:

1. Future orders will automatically have correct status
2. Existing orders are updated to correct status
3. You're ready to build the enrichment form (Phase 2)
4. Enrichment form will use product configurations to show appropriate fields
