-- Split factory floor inventory into ingredients, packaging, and supplies.

ALTER TABLE factory_opened_materials
  ADD COLUMN IF NOT EXISTS inventory_kind TEXT NOT NULL DEFAULT 'ingredients';

ALTER TABLE factory_opened_materials
  DROP CONSTRAINT IF EXISTS factory_opened_materials_inventory_kind_check;

ALTER TABLE factory_opened_materials
  ADD CONSTRAINT factory_opened_materials_inventory_kind_check
  CHECK (inventory_kind IN ('ingredients', 'packaging', 'supplies'));

CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_inventory_kind
  ON factory_opened_materials(inventory_kind);

-- Optional: classify procurement raw materials for factory open-package dropdowns
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS factory_inventory_kind TEXT;

ALTER TABLE raw_materials
  DROP CONSTRAINT IF EXISTS raw_materials_factory_inventory_kind_check;

ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_factory_inventory_kind_check
  CHECK (
    factory_inventory_kind IS NULL
    OR factory_inventory_kind IN ('ingredients', 'packaging', 'supplies')
  );

UPDATE factory_opened_materials
SET inventory_kind = 'ingredients'
WHERE inventory_kind IS NULL OR inventory_kind NOT IN ('ingredients', 'packaging', 'supplies');
