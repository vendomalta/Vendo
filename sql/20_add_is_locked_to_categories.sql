-- Add is_locked column to categories table
-- This allows locking specific categories for launch without deleting them

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN categories.is_locked IS 'Whether the category is locked (visible but non-interactive)';
