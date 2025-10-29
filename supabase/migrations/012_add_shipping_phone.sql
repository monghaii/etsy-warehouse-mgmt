-- Add shipping_phone column to orders table

-- Add the column if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(50);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_shipping_phone ON orders(shipping_phone);

