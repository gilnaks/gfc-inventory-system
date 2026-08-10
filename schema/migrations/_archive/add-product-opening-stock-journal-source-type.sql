-- Allow finished-goods opening stock journals when products are created with initial stock

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
