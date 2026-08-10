-- Add pull_out column to dsir_materials_inventory table
-- This allows tracking materials that are pulled out/removed from inventory

ALTER TABLE dsir_materials_inventory
ADD COLUMN IF NOT EXISTS pull_out INTEGER DEFAULT 0;

-- Optional: Add an index if you expect to query frequently on this column
CREATE INDEX IF NOT EXISTS idx_dsir_materials_inventory_pull_out ON dsir_materials_inventory(pull_out);

-- Update any existing records to have pull_out = 0 if null
UPDATE dsir_materials_inventory
SET pull_out = 0
WHERE pull_out IS NULL;

