-- Create payroll_deductions_refunds table
-- This table stores deductions and refunds for each staff member per week

CREATE TABLE IF NOT EXISTS payroll_deductions_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  utilities DECIMAL(10,2) DEFAULT 0,
  shortages DECIMAL(10,2) DEFAULT 0,
  cash_advances DECIMAL(10,2) DEFAULT 0,
  penalties DECIMAL(10,2) DEFAULT 0,
  others DECIMAL(10,2) DEFAULT 0,
  refunds DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, week_start_date, week_end_date)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_refunds_staff_id ON payroll_deductions_refunds(staff_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_refunds_week_dates ON payroll_deductions_refunds(week_start_date, week_end_date);

-- Enable RLS
ALTER TABLE payroll_deductions_refunds ENABLE ROW LEVEL SECURITY;

-- Create policy for payroll_deductions_refunds
DROP POLICY IF EXISTS "Allow all operations on payroll_deductions_refunds" ON payroll_deductions_refunds;
CREATE POLICY "Allow all operations on payroll_deductions_refunds" ON payroll_deductions_refunds FOR ALL USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_payroll_deductions_refunds_updated_at 
  BEFORE UPDATE ON payroll_deductions_refunds 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE payroll_deductions_refunds;
EXCEPTION
    WHEN duplicate_object THEN
        -- Table already in publication, ignore error
        NULL;
END $$;
