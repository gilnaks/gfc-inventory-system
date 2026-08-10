-- Draft production schedules + link material requests to schedule date / brand.

ALTER TABLE production_schedules
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE production_schedules
  DROP CONSTRAINT IF EXISTS production_schedules_status_check;

ALTER TABLE production_schedules
  ADD CONSTRAINT production_schedules_status_check
  CHECK (status IN ('draft', 'active', 'cancelled'));

UPDATE production_schedules
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('draft', 'active', 'cancelled');

ALTER TABLE factory_material_requests
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE factory_material_requests
  ADD COLUMN IF NOT EXISTS schedule_date DATE;

CREATE INDEX IF NOT EXISTS idx_factory_material_requests_brand_date
  ON factory_material_requests(brand_id, schedule_date);

CREATE INDEX IF NOT EXISTS idx_production_schedules_status_date
  ON production_schedules(schedule_date, status);
