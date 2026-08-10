-- Biometric attendance punches for GFC main (factory floor) staff
CREATE TABLE IF NOT EXISTS gfc_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_no INT NOT NULL,
  terminal_no INT,
  verify_mode INT,
  device_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  punch_at TIMESTAMPTZ NOT NULL,
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enrollment_no, punch_at)
);

CREATE INDEX IF NOT EXISTS idx_gfc_attendance_logs_work_date ON gfc_attendance_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_gfc_attendance_logs_staff_registration_id ON gfc_attendance_logs(staff_registration_id);

ALTER TABLE gfc_attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on gfc_attendance_logs" ON gfc_attendance_logs;
CREATE POLICY "Allow all on gfc_attendance_logs" ON gfc_attendance_logs FOR ALL USING (true);
