-- GFC Factory Rollout — Phase 4 intercompany transfer documents

CREATE TABLE IF NOT EXISTS intercompany_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number VARCHAR(40) NOT NULL,
  from_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  to_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'void')),
  transfer_price_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  margin_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(6,2),
  notes TEXT,
  journal_entry_id_from UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  journal_entry_id_to UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_by VARCHAR(120),
  posted_at TIMESTAMPTZ,
  posted_by VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_brand_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_intercompany_transfers_from ON intercompany_transfers(from_brand_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_intercompany_transfers_to ON intercompany_transfers(to_brand_id, transfer_date DESC);

CREATE TABLE IF NOT EXISTS intercompany_transfer_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES intercompany_transfers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  source_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  dest_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sku VARCHAR(100),
  description VARCHAR(300),
  quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(14,4) NOT NULL DEFAULT 0,
  line_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intercompany_transfer_lines_transfer
  ON intercompany_transfer_lines(transfer_id);

-- Journal source type for intercompany transfers
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',
    'opening_balance', 'year_end_close',
    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count',
    'payroll_run_accrual', 'payroll_run_payment', 'intercompany_transfer'
  ));

ALTER TABLE intercompany_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intercompany_transfer_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on intercompany_transfers" ON intercompany_transfers;
DROP POLICY IF EXISTS "Allow all on intercompany_transfer_lines" ON intercompany_transfer_lines;
CREATE POLICY "Allow all on intercompany_transfers" ON intercompany_transfers FOR ALL USING (true);
CREATE POLICY "Allow all on intercompany_transfer_lines" ON intercompany_transfer_lines FOR ALL USING (true);
