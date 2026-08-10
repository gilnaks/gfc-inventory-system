-- Developer "Lock Access" settings.
-- A row means the dashboard module (or one of its sub-tabs, when sub_tab_key is
-- set) is temporarily hidden for everyone except the developer role.
-- Unlocking deletes the row.

CREATE TABLE IF NOT EXISTS module_access_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  sub_tab_key TEXT,
  reason TEXT,
  locked_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_access_locks_target
  ON module_access_locks (module_key, COALESCE(sub_tab_key, ''));

DROP TRIGGER IF EXISTS update_module_access_locks_updated_at ON module_access_locks;
CREATE TRIGGER update_module_access_locks_updated_at
  BEFORE UPDATE ON module_access_locks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE module_access_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on module_access_locks" ON module_access_locks;
CREATE POLICY "Allow all on module_access_locks" ON module_access_locks
  FOR ALL USING (true);

-- Locks apply without a page refresh.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE module_access_locks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
