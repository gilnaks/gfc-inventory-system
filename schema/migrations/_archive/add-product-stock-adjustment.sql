-- Manual initial-stock edits from Product Inventory (Dr/Cr FG inventory vs variance).

CREATE TABLE IF NOT EXISTS product_stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_initial_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  new_initial_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  quantity_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit TEXT,
  journal_entry_id UUID REFERENCES accounting_journal_entries(id),
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_stock_adjustments_brand
  ON product_stock_adjustments (brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_stock_adjustments_product
  ON product_stock_adjustments (product_id, created_at DESC);

ALTER TABLE product_stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on product_stock_adjustments" ON product_stock_adjustments;
CREATE POLICY "Allow all on product_stock_adjustments" ON product_stock_adjustments FOR ALL USING (true);

ALTER TABLE accounting_journal_entries
  DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;

ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'material_movement',
    'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count', 'reversal',
    'opening_balance', 'year_end_close', 'payroll_run_accrual', 'payroll_run_payment',
    'intercompany_transfer', 'intercompany_transfer_settlement', 'production_batch',
    'staff_advance_disbursement', 'material_transfer',
    'factory_material_release', 'factory_wip_adjustment', 'product_opening_stock',
    'product_stock_adjustment'
  ));
