-- Payroll runs: weekly snapshots, per-staff lines, per-brand totals for GL posting

CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'calculated', 'approved', 'accrued', 'paid', 'void')),
  calculated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  accrued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by VARCHAR(120),
  approved_by VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start_date, week_end_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_week_end ON payroll_runs(week_end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

CREATE TABLE IF NOT EXISTS payroll_run_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE RESTRICT,
  hourly_rate_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
  regular_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
  double_pay_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
  special_pay_hours DECIMAL(8, 2) NOT NULL DEFAULT 0,
  regular_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  overtime_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  double_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  special_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  gross_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  deductions_refund_id UUID REFERENCES payroll_deductions_refunds(id) ON DELETE SET NULL,
  utilities DECIMAL(10, 2) NOT NULL DEFAULT 0,
  shortages DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cash_advances DECIMAL(10, 2) NOT NULL DEFAULT 0,
  penalties DECIMAL(10, 2) NOT NULL DEFAULT 0,
  others DECIMAL(10, 2) NOT NULL DEFAULT 0,
  refunds DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payroll_run_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_run ON payroll_run_lines(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_lines_staff ON payroll_run_lines(staff_id);

CREATE TABLE IF NOT EXISTS payroll_run_brand_totals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  gross_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0,
  refunds DECIMAL(12, 2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  withholdings_other DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cash_advances_withheld DECIMAL(12, 2) NOT NULL DEFAULT 0,
  journal_entry_id_accrual UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  journal_entry_id_payment UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  payment_voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payroll_run_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_run_brand_totals_run ON payroll_run_brand_totals(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_brand_totals_brand ON payroll_run_brand_totals(brand_id);

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_brand_totals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on payroll_runs" ON payroll_runs;
CREATE POLICY "Allow all on payroll_runs" ON payroll_runs FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on payroll_run_lines" ON payroll_run_lines;
CREATE POLICY "Allow all on payroll_run_lines" ON payroll_run_lines FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on payroll_run_brand_totals" ON payroll_run_brand_totals;
CREATE POLICY "Allow all on payroll_run_brand_totals" ON payroll_run_brand_totals FOR ALL USING (true);
