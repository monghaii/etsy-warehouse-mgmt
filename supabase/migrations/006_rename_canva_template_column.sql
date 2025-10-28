-- Migration: Rename canva_template_id to canva_template_url
-- This reflects the change from storing just template IDs to storing full Canva URLs

ALTER TABLE product_templates 
RENAME COLUMN canva_template_id TO canva_template_url;

-- Update the column type to TEXT since URLs can be longer than 255 chars
ALTER TABLE product_templates 
ALTER COLUMN canva_template_url TYPE TEXT;

