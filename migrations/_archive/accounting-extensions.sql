-- Accounting extensions: opening balance, year-end close, posting errors

-- Extend journal source_type
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',
    'opening_balance', 'year_end_close',
    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count'
  ));

-- One opening balance JE per brand (posted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_journal_one_opening_balance
  ON accounting_journal_entries(brand_id)
  WHERE source_type = 'opening_balance' AND status = 'posted';

-- Period year-close flag
ALTER TABLE accounting_periods
  ADD COLUMN IF NOT EXISTS year_closed BOOLEAN NOT NULL DEFAULT FALSE;

-- Year-end close registry (one close per fiscal year per brand)
CREATE TABLE IF NOT EXISTS accounting_year_end_closes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_by VARCHAR(120),
  UNIQUE(brand_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_accounting_year_end_closes_brand ON accounting_year_end_closes(brand_id);

-- Posting failure queue
CREATE TABLE IF NOT EXISTS accounting_posting_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL,
  source_id UUID NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounting_posting_errors_brand_unresolved
  ON accounting_posting_errors(brand_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_posting_errors_source
  ON accounting_posting_errors(brand_id, source_type, source_id);

ALTER TABLE accounting_year_end_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_posting_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on accounting_year_end_closes" ON accounting_year_end_closes;
CREATE POLICY "Allow all on accounting_year_end_closes" ON accounting_year_end_closes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on accounting_posting_errors" ON accounting_posting_errors;
CREATE POLICY "Allow all on accounting_posting_errors" ON accounting_posting_errors FOR ALL USING (true);
