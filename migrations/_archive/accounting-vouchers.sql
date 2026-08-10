-- Accounting vouchers: Payment Voucher (PV) and Petty Cash Voucher (PCV)

CREATE TABLE IF NOT EXISTS accounting_voucher_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  company_name VARCHAR(200) DEFAULT 'GILNAKS',
  company_address TEXT DEFAULT 'Lapu-lapu City, Cebu',
  approved_by_name VARCHAR(120) DEFAULT 'WENDELLIN C. NAKILA',
  approved_by_title VARCHAR(120) DEFAULT 'Accounting Manager',
  petty_cash_custodian_name VARCHAR(120) DEFAULT 'John Gilbert G. Nakila',
  petty_cash_custodian_title VARCHAR(200) DEFAULT 'Procurement Manager / Petty Cash Custodian',
  liquidated_by_name VARCHAR(120) DEFAULT 'WENDELLIN C. NAKILA',
  liquidated_by_title VARCHAR(120) DEFAULT 'Accounting Manager',
  pv_number_prefix VARCHAR(20) DEFAULT 'PV',
  pcv_number_prefix VARCHAR(20) DEFAULT 'PCV',
  pv_next_seq INTEGER DEFAULT 1,
  pcv_next_seq INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id)
);

CREATE TABLE IF NOT EXISTS accounting_vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment', 'petty_cash')),
  voucher_number VARCHAR(50) NOT NULL,
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department VARCHAR(100),
  requested_by VARCHAR(120),
  prepared_by VARCHAR(120),
  payee_name VARCHAR(200),
  -- Payment voucher fields
  payment_for TEXT,
  payee_kind VARCHAR(40) CHECK (payee_kind IS NULL OR payee_kind IN (
    'supplier', 'reimbursement', 'petty_cash_replenishment', 'invoice', 'payroll', 'other'
  )),
  payment_mode VARCHAR(20) CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'check', 'bank_gcash')),
  check_number VARCHAR(80),
  check_date DATE,
  bank_ref_number VARCHAR(80),
  bank_ref_date DATE,
  received_by VARCHAR(120),
  -- Petty cash fields
  purpose TEXT,
  amount_requested DECIMAL(12,2) DEFAULT 0,
  amount_released DECIMAL(12,2) DEFAULT 0,
  date_released DATE,
  actual_expense DECIMAL(12,2),
  cash_advance DECIMAL(12,2),
  excess_returned DECIMAL(12,2),
  additional_reimbursement DECIMAL(12,2),
  -- Workflow
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  liquidated_at TIMESTAMPTZ,
  prepared_by_name VARCHAR(120),
  requestor_name VARCHAR(120),
  approved_by_name VARCHAR(120),
  approved_by_title VARCHAR(120),
  liquidated_by_name VARCHAR(120),
  liquidated_by_title VARCHAR(120),
  -- Supporting document flags
  has_or BOOLEAN DEFAULT FALSE,
  has_si BOOLEAN DEFAULT FALSE,
  has_dr BOOLEAN DEFAULT FALSE,
  has_transport_receipt BOOLEAN DEFAULT FALSE,
  has_po BOOLEAN DEFAULT FALSE,
  has_invoice BOOLEAN DEFAULT FALSE,
  has_receiving_report BOOLEAN DEFAULT FALSE,
  supporting_docs_other TEXT,
  notes TEXT,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voucher_type, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_brand ON accounting_vouchers(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_type ON accounting_vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_status ON accounting_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_date ON accounting_vouchers(voucher_date);

CREATE TABLE IF NOT EXISTS accounting_voucher_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  reference_doc VARCHAR(120),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_voucher_lines_voucher ON accounting_voucher_lines(voucher_id);

CREATE TABLE IF NOT EXISTS accounting_voucher_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'supplier'
  )),
  source_id UUID NOT NULL,
  link_role VARCHAR(20) NOT NULL DEFAULT 'primary' CHECK (link_role IN ('primary', 'supporting')),
  attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_voucher_links_voucher ON accounting_voucher_links(voucher_id);
CREATE INDEX IF NOT EXISTS idx_accounting_voucher_links_source ON accounting_voucher_links(source_type, source_id);

-- App enforces one primary voucher per source; index omitted to allow re-link after cancel

ALTER TABLE accounting_voucher_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_voucher_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_voucher_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on accounting_voucher_settings" ON accounting_voucher_settings;
CREATE POLICY "Allow all on accounting_voucher_settings" ON accounting_voucher_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_vouchers" ON accounting_vouchers;
CREATE POLICY "Allow all on accounting_vouchers" ON accounting_vouchers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_voucher_lines" ON accounting_voucher_lines;
CREATE POLICY "Allow all on accounting_voucher_lines" ON accounting_voucher_lines FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_voucher_links" ON accounting_voucher_links;
CREATE POLICY "Allow all on accounting_voucher_links" ON accounting_voucher_links FOR ALL USING (true);

DROP TRIGGER IF EXISTS update_accounting_voucher_settings_updated_at ON accounting_voucher_settings;
CREATE TRIGGER update_accounting_voucher_settings_updated_at
  BEFORE UPDATE ON accounting_voucher_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_vouchers_updated_at ON accounting_vouchers;
CREATE TRIGGER update_accounting_vouchers_updated_at
  BEFORE UPDATE ON accounting_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
