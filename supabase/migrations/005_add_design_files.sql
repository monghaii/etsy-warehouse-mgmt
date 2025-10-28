-- Add design_files column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS design_files JSONB DEFAULT '[]'::jsonb;

-- Add index for design_complete status
CREATE INDEX IF NOT EXISTS idx_orders_status_design_complete ON orders(status) WHERE status = 'design_complete';

-- Comment for documentation
COMMENT ON COLUMN orders.design_files IS 'Array of design file objects: [{transaction_id, file_path, file_url, uploaded_at}]';

