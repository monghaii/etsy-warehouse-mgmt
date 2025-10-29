-- Add Shopify-specific fields to stores table

-- Add shop_id column (for Etsy) and shop_domain column (for Shopify)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_id VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_domain VARCHAR(255);

-- Add access_token column for Shopify Admin API tokens (separate from encrypted api_token)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS access_token TEXT;

-- Make store_id nullable since Shopify uses shop_domain instead
ALTER TABLE stores ALTER COLUMN store_id DROP NOT NULL;

-- Update existing Etsy stores to populate shop_id from store_id
UPDATE stores 
SET shop_id = store_id 
WHERE platform = 'etsy' AND shop_id IS NULL;

-- Add index for shop_domain for faster Shopify lookups
CREATE INDEX IF NOT EXISTS idx_stores_shop_domain ON stores(shop_domain);

