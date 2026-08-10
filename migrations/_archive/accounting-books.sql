-- Accounting books: chart of accounts, journal, GL, reconciliation

-- Chart of accounts
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_brand ON accounting_accounts(brand_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_type ON accounting_accounts(brand_id, account_type);

-- Accounting periods
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_brand ON accounting_periods(brand_id);

-- Journal entries
CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  entry_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'delivery_receipt', 'reversal'
  )),
  source_id UUID,
  posted_at TIMESTAMPTZ,
  posted_by VARCHAR(120),
  reverses_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, entry_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_posted_source
  ON accounting_journal_entries(brand_id, source_type, source_id)
  WHERE status = 'posted' AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_journal_brand_date ON accounting_journal_entries(brand_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_status ON accounting_journal_entries(brand_id, status);

-- Journal lines
CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL DEFAULT 1,
  debit DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit DECIMAL(14,2) NOT NULL DEFAULT 0,
  memo TEXT,
  voucher_line_id UUID REFERENCES accounting_voucher_lines(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_account ON accounting_journal_lines(account_id);

-- GL period balances
CREATE TABLE IF NOT EXISTS accounting_gl_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  debit_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_gl_balances_brand_period ON accounting_gl_balances(brand_id, period_id);

-- Bank accounts (operational, linked to GL cash account)
CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  account_last4 VARCHAR(4),
  gl_account_id UUID NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_bank_accounts_brand ON accounting_bank_accounts(brand_id);

-- Bank reconciliations
CREATE TABLE IF NOT EXISTS accounting_bank_reconciliations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES accounting_bank_accounts(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_ending_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  book_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  reconciled_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounting_bank_reconciliation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_id UUID NOT NULL REFERENCES accounting_bank_reconciliations(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  description TEXT,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_recon_items_recon ON accounting_bank_reconciliation_items(reconciliation_id);

-- Petty cash reconciliations
CREATE TABLE IF NOT EXISTS accounting_petty_cash_reconciliations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
  pcv_expenses_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  variance DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  counted_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_recon_brand ON accounting_petty_cash_reconciliations(brand_id);

-- Extend voucher settings with books defaults
ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS petty_cash_fund_amount DECIMAL(12,2) DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS je_number_prefix VARCHAR(20) DEFAULT 'JE',
  ADD COLUMN IF NOT EXISTS je_next_seq INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS default_cash_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_ap_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_ar_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_sales_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_delivery_income_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_inventory_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_petty_cash_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coa_seeded_at TIMESTAMPTZ;

-- Extend vouchers with journal link
ALTER TABLE accounting_vouchers
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

-- Extend voucher lines with expense/debit account
ALTER TABLE accounting_voucher_lines
  ADD COLUMN IF NOT EXISTS debit_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;

-- Customer order journal links
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS journal_entry_id_revenue UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id_cash UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

-- Delivery receipt journal link
ALTER TABLE delivery_receipts
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_gl_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_bank_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_petty_cash_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on accounting_accounts" ON accounting_accounts;
CREATE POLICY "Allow all on accounting_accounts" ON accounting_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_periods" ON accounting_periods;
CREATE POLICY "Allow all on accounting_periods" ON accounting_periods FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_journal_entries" ON accounting_journal_entries;
CREATE POLICY "Allow all on accounting_journal_entries" ON accounting_journal_entries FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_journal_lines" ON accounting_journal_lines;
CREATE POLICY "Allow all on accounting_journal_lines" ON accounting_journal_lines FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_gl_balances" ON accounting_gl_balances;
CREATE POLICY "Allow all on accounting_gl_balances" ON accounting_gl_balances FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_bank_accounts" ON accounting_bank_accounts;
CREATE POLICY "Allow all on accounting_bank_accounts" ON accounting_bank_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_bank_reconciliations" ON accounting_bank_reconciliations;
CREATE POLICY "Allow all on accounting_bank_reconciliations" ON accounting_bank_reconciliations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_bank_reconciliation_items" ON accounting_bank_reconciliation_items;
CREATE POLICY "Allow all on accounting_bank_reconciliation_items" ON accounting_bank_reconciliation_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_petty_cash_reconciliations" ON accounting_petty_cash_reconciliations;
CREATE POLICY "Allow all on accounting_petty_cash_reconciliations" ON accounting_petty_cash_reconciliations FOR ALL USING (true);

DROP TRIGGER IF EXISTS update_accounting_accounts_updated_at ON accounting_accounts;
CREATE TRIGGER update_accounting_accounts_updated_at
  BEFORE UPDATE ON accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_periods_updated_at ON accounting_periods;
CREATE TRIGGER update_accounting_periods_updated_at
  BEFORE UPDATE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_journal_entries_updated_at ON accounting_journal_entries;
CREATE TRIGGER update_accounting_journal_entries_updated_at
  BEFORE UPDATE ON accounting_journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_bank_accounts_updated_at ON accounting_bank_accounts;
CREATE TRIGGER update_accounting_bank_accounts_updated_at
  BEFORE UPDATE ON accounting_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounting_bank_reconciliations_updated_at ON accounting_bank_reconciliations;
CREATE TRIGGER update_accounting_bank_reconciliations_updated_at
  BEFORE UPDATE ON accounting_bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
