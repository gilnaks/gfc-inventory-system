-- Manual break hours per staff/day, deducted from biometric working hours.
CREATE TABLE IF NOT EXISTS gfc_attendance_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  break_hours NUMERIC(4, 2) NOT NULL DEFAULT 0 CHECK (break_hours >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_registration_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_gfc_attendance_breaks_work_date
  ON gfc_attendance_breaks(work_date);

CREATE INDEX IF NOT EXISTS idx_gfc_attendance_breaks_staff_registration_id
  ON gfc_attendance_breaks(staff_registration_id);

ALTER TABLE gfc_attendance_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on gfc_attendance_breaks" ON gfc_attendance_breaks;
CREATE POLICY "Allow all on gfc_attendance_breaks"
  ON gfc_attendance_breaks FOR ALL USING (true);
