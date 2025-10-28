-- Create shipping_settings table
CREATE TABLE IF NOT EXISTS shipping_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ship_from_name VARCHAR(255),
  ship_from_company VARCHAR(255),
  ship_from_address_line1 VARCHAR(255),
  ship_from_address_line2 VARCHAR(255),
  ship_from_city VARCHAR(100),
  ship_from_state VARCHAR(50),
  ship_from_zip VARCHAR(20),
  ship_from_country VARCHAR(2) DEFAULT 'US',
  ship_from_phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own shipping settings
CREATE POLICY "Users can view own shipping settings"
  ON shipping_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own shipping settings
CREATE POLICY "Users can insert own shipping settings"
  ON shipping_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own shipping settings
CREATE POLICY "Users can update own shipping settings"
  ON shipping_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own shipping settings
CREATE POLICY "Users can delete own shipping settings"
  ON shipping_settings
  FOR DELETE
  USING (auth.uid() = user_id);

