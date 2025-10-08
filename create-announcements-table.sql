-- Create announcements table for general announcements and staff-specific messages
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general', 'notice', 'warning')),
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_staff_id ON announcements(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

-- Add comments
COMMENT ON TABLE announcements IS 'Stores general announcements and staff-specific messages (notices/warnings)';
COMMENT ON COLUMN announcements.type IS 'general = visible to all staff, notice = individual staff notice, warning = individual staff warning';
COMMENT ON COLUMN announcements.staff_registration_id IS 'NULL for general announcements, specific staff ID for individual messages';
COMMENT ON COLUMN announcements.is_active IS 'Set to false to hide/archive the announcement';

