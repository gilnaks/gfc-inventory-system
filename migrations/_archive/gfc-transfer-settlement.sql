-- GFC intercompany transfer settlement (receivables collection)

ALTER TABLE intercompany_transfers
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_by VARCHAR(120),
  ADD COLUMN IF NOT EXISTS settlement_journal_entry_id_from UUID
    REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_journal_entry_id_to UUID
    REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_intercompany_transfers_settled
  ON intercompany_transfers(from_brand_id, settled_at)
  WHERE status = 'posted';

ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',
    'opening_balance', 'year_end_close',
    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count',
    'payroll_run_accrual', 'payroll_run_payment', 'intercompany_transfer',
    'intercompany_transfer_settlement', 'production_batch'
  ));
