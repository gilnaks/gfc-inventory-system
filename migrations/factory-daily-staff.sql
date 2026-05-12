-- Staff signed in on the factory floor for a given PH calendar day (managed from /factory)
CREATE TABLE IF NOT EXISTS factory_daily_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date DATE NOT NULL,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (work_date, staff_registration_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_daily_staff_work_date ON factory_daily_staff(work_date);

ALTER TABLE factory_daily_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on factory_daily_staff" ON factory_daily_staff;
CREATE POLICY "Allow all on factory_daily_staff" ON factory_daily_staff FOR ALL USING (true);
