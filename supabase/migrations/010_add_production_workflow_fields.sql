-- Add production workflow fields (if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'production_started_at') THEN
    ALTER TABLE orders ADD COLUMN production_started_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'needs_design_revision') THEN
    ALTER TABLE orders ADD COLUMN needs_design_revision BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'design_revision_notes') THEN
    ALTER TABLE orders ADD COLUMN design_revision_notes TEXT;
  END IF;
END $$;

-- Add index for revision orders (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE indexname = 'idx_orders_needs_revision') THEN
    CREATE INDEX idx_orders_needs_revision ON orders(needs_design_revision) WHERE needs_design_revision = TRUE;
  END IF;
END $$;

