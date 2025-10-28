-- Migration: Add enrichment-related fields to orders table
-- This supports the public enrichment form where customers submit custom assets

-- Add custom_images to store uploaded image URLs/paths
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS custom_images JSONB DEFAULT '[]'::jsonb;

-- Add customer_notes for additional instructions from customer
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Add enrichment_submitted_at timestamp (already exists but ensure it's there)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS enrichment_submitted_at TIMESTAMP WITH TIME ZONE;

-- Add enrichment_email to store customer's email from enrichment form
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS enrichment_email VARCHAR(255);

-- Create index for faster lookups by order number
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

COMMENT ON COLUMN orders.custom_images IS 'Array of uploaded image URLs/paths from customer enrichment form';
COMMENT ON COLUMN orders.customer_notes IS 'Additional notes/instructions provided by customer during enrichment';
COMMENT ON COLUMN orders.enrichment_email IS 'Customer email address provided during enrichment form submission';

