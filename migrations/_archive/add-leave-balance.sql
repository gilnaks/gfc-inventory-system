-- Add leave_balance field to staff_registrations table
-- This migration adds a leave_balance field with a default value of 10 days

-- Add the leave_balance column to staff_registrations table
ALTER TABLE staff_registrations 
ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 10;

-- Update existing staff to have 10 days leave balance if they don't have it set
UPDATE staff_registrations 
SET leave_balance = 10 
WHERE leave_balance IS NULL;

-- Add a check constraint to ensure leave_balance is between 0 and 10
ALTER TABLE staff_registrations 
ADD CONSTRAINT check_leave_balance 
CHECK (leave_balance >= 0 AND leave_balance <= 10);

-- Add comment to the column for documentation
COMMENT ON COLUMN staff_registrations.leave_balance IS 'Annual leave balance in days (max 10 days per year)';
