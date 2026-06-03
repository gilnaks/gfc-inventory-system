-- Factory floor: track opened / partial raw material packages (bottles, sacks, etc.)
-- Used alongside product BOM for production consumption monitoring.

CREATE TABLE IF NOT EXISTS factory_opened_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  label TEXT,
  quantity_opened DECIMAL(12, 4) NOT NULL CHECK (quantity_opened > 0),
  quantity_remaining DECIMAL(12, 4) NOT NULL CHECK (quantity_remaining >= 0),
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'depleted', 'discarded')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT factory_opened_remaining_lte_opened
    CHECK (quantity_remaining <= quantity_opened)
);

CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_material
  ON factory_opened_materials(material_id);

CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_status
  ON factory_opened_materials(status);

CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_opened_at
  ON factory_opened_materials(opened_at DESC);

ALTER TABLE factory_opened_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on factory_opened_materials" ON factory_opened_materials;
CREATE POLICY "Allow all on factory_opened_materials"
  ON factory_opened_materials FOR ALL USING (true);
