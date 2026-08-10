-- Sales incentive pay on finalized payroll run lines
ALTER TABLE payroll_run_lines
  ADD COLUMN IF NOT EXISTS incentive_pay DECIMAL(12, 2) NOT NULL DEFAULT 0;
