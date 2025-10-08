-- Add hours, day_type, and is_absent fields to staff_schedules table
-- This migration adds fields needed for absence tracking and payroll calculations

-- Add hours column (decimal to support 0.5 hour increments)
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS hours DECIMAL(4,1) DEFAULT 11.0;

-- Add day_type column for holiday tracking
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS day_type VARCHAR(20) DEFAULT 'default';

-- Add check constraint for day_type
ALTER TABLE staff_schedules 
ADD CONSTRAINT IF NOT EXISTS staff_schedules_day_type_check 
CHECK (day_type IN ('default', 'regular-holiday', 'special-holiday'));

-- Add is_absent column for absence tracking
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS is_absent BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN staff_schedules.hours IS 'Number of hours worked (supports 0.5 hour increments)';
COMMENT ON COLUMN staff_schedules.day_type IS 'Type of day: default, regular-holiday, or special-holiday';
COMMENT ON COLUMN staff_schedules.is_absent IS 'Whether the staff member was marked as absent (true = absent, hours should be 0)';

