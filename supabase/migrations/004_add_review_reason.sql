-- Add review_reason column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Add index for needs_review orders for faster sorting
CREATE INDEX IF NOT EXISTS idx_orders_status_review ON orders(status) WHERE status = 'needs_review';

