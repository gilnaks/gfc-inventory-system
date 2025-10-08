-- Add total_warnings column to staff_registrations table
-- This column tracks the number of absence_admin (warning) occurrences

-- Add the column with default value of 0
ALTER TABLE staff_registrations 
ADD COLUMN IF NOT EXISTS total_warnings INTEGER DEFAULT 0;

-- Add comment to document the column
COMMENT ON COLUMN staff_registrations.total_warnings IS 
'Total number of absence warnings (absence_admin) assigned to this staff member';

-- Optionally, calculate existing warnings from leave_requests table
UPDATE staff_registrations
SET total_warnings = (
  SELECT COUNT(*)
  FROM leave_requests
  WHERE leave_requests.staff_registration_id = staff_registrations.id
    AND leave_requests.request_type = 'absence_admin'
    AND leave_requests.status = 'approved'
);

