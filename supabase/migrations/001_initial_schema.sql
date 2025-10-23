-- Etsy Store Management SaaS - Initial Database Schema
-- Phase 0: Foundation
-- This migration creates all tables with RLS enabled but no policies (service role key bypasses RLS)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STORES TABLE
-- Configuration for connected Etsy stores
-- ============================================================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL DEFAULT 'etsy', -- 'etsy' or 'shopify'
  store_name VARCHAR(255) NOT NULL,
  store_id VARCHAR(255) NOT NULL, -- Platform's store/shop ID
  api_token_encrypted TEXT NOT NULL, -- Encrypted API token
  is_active BOOLEAN DEFAULT true,
  last_sync_timestamp TIMESTAMP,
  sync_frequency_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stores_platform ON stores(platform);
CREATE INDEX idx_stores_active ON stores(is_active);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE (Profile Extension)
-- Extends Supabase Auth's auth.users with additional metadata
-- ============================================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'warehouse', -- 'admin', 'designer', 'warehouse'
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Automatically create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'warehouse')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_active ON public.users(is_active);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRODUCT TEMPLATES TABLE
-- Product configurations (dimensions, SLA, Canva templates)
-- ============================================================================
CREATE TABLE product_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) NOT NULL UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  
  -- Default shipping specs
  default_length_inches DECIMAL(8,2),
  default_width_inches DECIMAL(8,2),
  default_height_inches DECIMAL(8,2),
  default_weight_oz DECIMAL(8,2),
  
  -- SLA
  sla_business_days INTEGER DEFAULT 5,
  
  -- Canva
  canva_template_id VARCHAR(255),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_templates_sku ON product_templates(sku);
CREATE INDEX idx_product_templates_active ON product_templates(is_active);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PRODUCT DESIGN GROUPS TABLE
-- Daily Canva files per product (one file per product per day with multiple pages)
-- ============================================================================
CREATE TABLE product_design_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_sku VARCHAR(100) NOT NULL,
  design_date DATE NOT NULL,
  
  canva_design_id VARCHAR(255),
  canva_edit_url TEXT,
  canva_template_id VARCHAR(255),
  
  design_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'complete'
  assigned_to UUID REFERENCES public.users(id),
  
  order_count INTEGER DEFAULT 0,
  
  -- Print roll assembly
  print_roll_generated BOOLEAN DEFAULT false,
  print_roll_url TEXT,
  print_roll_metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  CONSTRAINT unique_product_day UNIQUE(product_sku, design_date)
);

CREATE INDEX idx_design_groups_status ON product_design_groups(design_status);
CREATE INDEX idx_design_groups_sku ON product_design_groups(product_sku);
CREATE INDEX idx_design_groups_date ON product_design_groups(design_date);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE product_design_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORDERS TABLE
-- Main order tracking table
-- ============================================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Source Information
  store_id UUID REFERENCES stores(id),
  platform VARCHAR(50) NOT NULL, -- 'etsy', 'shopify'
  external_order_id VARCHAR(255) NOT NULL,
  external_receipt_id VARCHAR(255),
  
  -- Order Details
  order_number VARCHAR(100) NOT NULL,
  order_date TIMESTAMP NOT NULL,
  
  -- Customer Information
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  shipping_address_line1 VARCHAR(255),
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_zip VARCHAR(20),
  shipping_country VARCHAR(100),
  
  -- Product Information
  product_sku VARCHAR(100),
  product_name VARCHAR(255),
  product_category VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  
  -- Order Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending_enrichment',
  is_late BOOLEAN DEFAULT false,
  days_overdue INTEGER DEFAULT 0,
  late_reason TEXT,
  
  -- Enrichment
  enrichment_status VARCHAR(50),
  custom_text TEXT,
  custom_images JSONB,
  enrichment_notes TEXT,
  enrichment_submitted_at TIMESTAMP,
  customer_submission_email VARCHAR(255),
  
  -- Review Flagging
  needs_review BOOLEAN DEFAULT false,
  review_reason VARCHAR(100),
  review_notes TEXT,
  flagged_by UUID REFERENCES public.users(id),
  flagged_at TIMESTAMP,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Design
  product_design_group_id UUID REFERENCES product_design_groups(id),
  canva_design_id VARCHAR(255),
  canva_edit_url TEXT,
  design_assigned_to UUID REFERENCES public.users(id),
  design_started_at TIMESTAMP,
  design_completed_at TIMESTAMP,
  
  -- Production
  production_status VARCHAR(50),
  production_notes TEXT,
  produced_by UUID REFERENCES public.users(id),
  produced_at TIMESTAMP,
  
  -- Metadata Image
  metadata_image_generated BOOLEAN DEFAULT false,
  metadata_image_url TEXT,
  
  -- Print Roll Assembly
  print_roll_generated BOOLEAN DEFAULT false,
  print_roll_url TEXT,
  print_roll_metadata JSONB,
  
  -- Shipping
  package_length_inches DECIMAL(8,2),
  package_width_inches DECIMAL(8,2),
  package_height_inches DECIMAL(8,2),
  package_weight_oz DECIMAL(8,2),
  dimensions_overridden BOOLEAN DEFAULT false,
  
  tracking_number VARCHAR(255),
  carrier VARCHAR(100),
  service_type VARCHAR(100),
  shipstation_shipment_id VARCHAR(255),
  label_generated_at TIMESTAMP,
  label_pdf_url TEXT,
  
  -- Scan-to-Label
  scanned_for_label_at TIMESTAMP,
  label_auto_printed BOOLEAN DEFAULT false,
  
  loaded_for_shipment_at TIMESTAMP,
  loaded_by UUID REFERENCES public.users(id),
  
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  current_tracking_status VARCHAR(100),
  last_tracking_update TIMESTAMP,
  tracking_history JSONB,
  
  -- SLA
  expected_ship_date DATE,
  sla_days INTEGER,
  
  -- Metadata
  raw_order_data JSONB,
  internal_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_external_order UNIQUE(platform, external_order_id)
);

-- Indexes for performance
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_late ON orders(is_late);
CREATE INDEX idx_orders_tracking ON orders(tracking_number);
CREATE INDEX idx_orders_external ON orders(external_order_id);
CREATE INDEX idx_orders_design_group ON orders(product_design_group_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORDER STATUS HISTORY TABLE
-- Audit trail for order status changes
-- ============================================================================
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_status_history_created ON order_status_history(created_at);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SYNC LOGS TABLE
-- Logging for order sync operations
-- ============================================================================
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  sync_started_at TIMESTAMP NOT NULL,
  sync_completed_at TIMESTAMP,
  orders_fetched INTEGER DEFAULT 0,
  orders_imported INTEGER DEFAULT 0,
  orders_skipped INTEGER DEFAULT 0,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_store ON sync_logs(store_id);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SYSTEM CONFIG TABLE
-- System-wide configuration settings
-- ============================================================================
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS (no policies - service role bypasses)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- AUTOMATIC TIMESTAMP UPDATES
-- Update updated_at on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_templates_updated_at BEFORE UPDATE ON product_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTOMATIC STATUS HISTORY LOGGING
-- Log all order status changes to order_status_history
-- ============================================================================
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, previous_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_order_status_changes AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ============================================================================
-- INITIAL DATA
-- Some default system configuration
-- ============================================================================
INSERT INTO system_config (key, value, description) VALUES
  ('default_sla_days', '5', 'Default SLA in business days'),
  ('late_order_threshold_hours', '24', 'Hours past SLA before flagging as late'),
  ('sync_frequency_minutes', '15', 'Default store sync frequency');

-- ============================================================================
-- STORAGE BUCKETS SETUP
-- Note: This SQL is for reference. Storage buckets are typically created via Supabase Dashboard or CLI
-- ============================================================================

-- Create customer-uploads bucket (PRIVATE for security)
-- Run this in Supabase Dashboard SQL Editor or via CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('customer-uploads', 'customer-uploads', false);

-- Since we're using service role key server-side, we have full access to private buckets
-- No storage policies needed - service role bypasses all RLS

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

