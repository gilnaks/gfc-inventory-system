-- Factory floor: production batch runs with BOM consumption from opened packages.

CREATE TABLE IF NOT EXISTS factory_production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES production_schedules(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  batch_number TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_production_batches_schedule
  ON factory_production_batches(schedule_id, work_date);

CREATE INDEX IF NOT EXISTS idx_factory_production_batches_status
  ON factory_production_batches(work_date, status);

CREATE TABLE IF NOT EXISTS factory_batch_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES factory_production_batches(id) ON DELETE CASCADE,
  opened_material_id UUID REFERENCES factory_opened_materials(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity_used NUMERIC(12, 4) NOT NULL CHECK (quantity_used > 0),
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_batch_material_usage_batch
  ON factory_batch_material_usage(batch_id);

ALTER TABLE factory_production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_batch_material_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on factory_production_batches" ON factory_production_batches;
CREATE POLICY "Allow all on factory_production_batches"
  ON factory_production_batches FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on factory_batch_material_usage" ON factory_batch_material_usage;
CREATE POLICY "Allow all on factory_batch_material_usage"
  ON factory_batch_material_usage FOR ALL USING (true);
