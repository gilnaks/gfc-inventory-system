-- Update leave_requests table to support new absence types
-- This migration updates the request_type check constraint

-- Drop the existing check constraint (try multiple possible names)
DO $$ 
BEGIN
    -- Try to drop the constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'leave_requests_request_type_check' 
        AND table_name = 'leave_requests'
    ) THEN
        ALTER TABLE leave_requests DROP CONSTRAINT leave_requests_request_type_check;
    END IF;
END $$;

-- Add new check constraint with updated request types
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_request_type_check CHECK (request_type IN ('absence_sickness', 'absence_family', 'absence_authorized', 'absence_personal', 'absence_bereavement', 'absence_vacation', 'absence_admin'));

-- Add comment to document the constraint
COMMENT ON CONSTRAINT leave_requests_request_type_check ON leave_requests IS 
'Allows only the following request types: absence_sickness (1 day before), absence_family (2 days before), absence_authorized (7 days before), absence_personal (2 days before), absence_bereavement (1 day before), absence_vacation (7 days before), absence_admin (admin-marked absence, auto-created from schedule)';

