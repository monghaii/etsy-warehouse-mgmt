-- Add personalization configuration to product_templates table
-- This allows us to track what type of personalization each product requires

ALTER TABLE product_templates
ADD COLUMN personalization_type VARCHAR(50) DEFAULT 'none', -- 'none', 'notes', 'image', 'both'
ADD COLUMN personalization_notes TEXT; -- Instructions for the personalization field

-- Update the comment on the table
COMMENT ON COLUMN product_templates.personalization_type IS 'Type of personalization: none, notes, image, or both';
COMMENT ON COLUMN product_templates.personalization_notes IS 'Instructions or description for the personalization field';

