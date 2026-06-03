-- Track consumption of released factory material requests when opening packages on the floor.

ALTER TABLE factory_material_requests
  ADD COLUMN IF NOT EXISTS quantity_used NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE factory_material_requests
  DROP CONSTRAINT IF EXISTS factory_material_requests_quantity_used_check;

ALTER TABLE factory_material_requests
  ADD CONSTRAINT factory_material_requests_quantity_used_check
  CHECK (quantity_used >= 0 AND quantity_used <= quantity);

ALTER TABLE factory_opened_materials
  ADD COLUMN IF NOT EXISTS factory_request_id UUID REFERENCES factory_material_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factory_opened_materials_request
  ON factory_opened_materials(factory_request_id);
