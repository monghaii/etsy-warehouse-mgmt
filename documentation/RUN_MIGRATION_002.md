# Run Migration 002: Add Personalization to Products

## Migration File

`supabase/migrations/002_add_personalization_to_products.sql`

## What It Does

Adds `personalization_type` and `personalization_notes` columns to the `product_templates` table.

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/002_add_personalization_to_products.sql`
4. Paste into the SQL Editor
5. Click **Run**

### Option 2: Supabase CLI

```bash
# Make sure you're in the project directory
cd /Users/momo/Developer/etsy-saas

# Run the migration
supabase db push

# Or run the SQL file directly
psql $DATABASE_URL -f supabase/migrations/002_add_personalization_to_products.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check that the new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'product_templates'
  AND column_name IN ('personalization_type', 'personalization_notes');
```

Expected result:

- `personalization_type` - `character varying(50)` - default: `'none'`
- `personalization_notes` - `text` - default: `NULL`

## Next Steps

After running the migration:

1. Navigate to **Settings → Products** in your app
2. You'll see a yellow alert if there are unconfigured SKUs
3. Click "Configure Now" to set up products for each SKU
4. Define personalization requirements for each product
