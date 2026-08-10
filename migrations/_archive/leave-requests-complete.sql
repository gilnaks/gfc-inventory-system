-- Complete Leave Requests System Setup
-- This file creates the entire leave request system without RLS complications

-- Drop table if exists (for clean setup)
DROP TABLE IF EXISTS leave_requests CASCADE;

-- Create leave_requests table
CREATE TABLE leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('leave', 'absence')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES staff_registrations(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_leave_requests_staff ON leave_requests(staff_registration_id);
CREATE INDEX idx_leave_requests_location ON leave_requests(location_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_created_at ON leave_requests(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leave_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_requests_updated_at();

-- Grant permissions to all users (no RLS restrictions)
GRANT ALL ON leave_requests TO authenticated;
GRANT ALL ON leave_requests TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Ensure RLS is disabled (this is the key fix)
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;

-- Insert some sample data for testing (optional)
-- Uncomment the following lines if you want sample data
/*
INSERT INTO leave_requests (staff_registration_id, location_id, request_type, start_date, end_date, reason)
SELECT 
  sr.id,
  l.id,
  'leave',
  CURRENT_DATE + INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '2 days',
  'Sample leave request for testing'
FROM staff_registrations sr
CROSS JOIN locations l
LIMIT 1;
*/

-- Verify table creation
SELECT 
  schemaname, 
  tablename, 
  rowsecurity,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE tablename = 'leave_requests';

-- Show table structure
\d leave_requests;
