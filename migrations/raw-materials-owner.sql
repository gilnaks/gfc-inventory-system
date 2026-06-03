-- Owner label for raw materials (brand names or custom values)
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS owner VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_raw_materials_owner ON raw_materials(owner);
