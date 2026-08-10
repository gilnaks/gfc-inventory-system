-- Procurement materials transfers (GFC raw_materials -> retail brand raw_materials)

CREATE TABLE IF NOT EXISTS material_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_number VARCHAR(40) NOT NULL,
  from_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  to_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'void')),
  cost_amount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_material_transfers_from ON material_transfers(from_brand_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_transfers_to ON material_transfers(to_brand_id, transfer_date DESC);

CREATE TABLE IF NOT EXISTS material_transfer_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES material_transfers(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL DEFAULT 1,
  source_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  dest_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
  sku VARCHAR(100),
  description VARCHAR(300),
  quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  line_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_transfer_lines_transfer
  ON material_transfer_lines(transfer_id);

ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'material_movement',
    'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count', 'reversal',
    'opening_balance', 'year_end_close', 'payroll_run_accrual', 'payroll_run_payment',
    'intercompany_transfer', 'intercompany_transfer_settlement', 'production_batch',
    'staff_advance_disbursement', 'material_transfer'
  ));

ALTER TABLE material_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_transfer_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on material_transfers" ON material_transfers;
DROP POLICY IF EXISTS "Allow all on material_transfer_lines" ON material_transfer_lines;
CREATE POLICY "Allow all on material_transfers" ON material_transfers FOR ALL USING (true);
CREATE POLICY "Allow all on material_transfer_lines" ON material_transfer_lines FOR ALL USING (true);
