-- Add fields for tracking number and shipping label URL (if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'label_url') THEN
    ALTER TABLE orders ADD COLUMN label_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'label_downloaded_at') THEN
    ALTER TABLE orders ADD COLUMN label_downloaded_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add index for tracking number lookups (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE indexname = 'idx_orders_tracking_number') THEN
    CREATE INDEX idx_orders_tracking_number ON orders(tracking_number);
  END IF;
END $$;

