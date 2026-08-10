-- Payroll GL posting: COA accounts, settings, journal source types, voucher links

-- 1150 Staff Advances for existing brands
INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)
SELECT b.id, '1150', 'Staff Advances', 'asset', 'debit', true
FROM brands b
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_accounts a
  WHERE a.brand_id = b.id AND a.code = '1150'
);

-- 2110 Payroll Withholdings for existing brands
INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)
SELECT b.id, '2110', 'Payroll Withholdings', 'liability', 'credit', true
FROM brands b
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_accounts a
  WHERE a.brand_id = b.id AND a.code = '2110'
);

ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_payroll_expense_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_accrued_payroll_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_staff_advance_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL;

UPDATE accounting_voucher_settings s
SET default_payroll_expense_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id AND a.code = '5800'
  AND s.default_payroll_expense_account_id IS NULL;

UPDATE accounting_voucher_settings s
SET default_accrued_payroll_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id AND a.code = '2100'
  AND s.default_accrued_payroll_account_id IS NULL;

UPDATE accounting_voucher_settings s
SET default_staff_advance_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id AND a.code = '1150'
  AND s.default_staff_advance_account_id IS NULL;

-- Extend journal source_type
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',
    'opening_balance', 'year_end_close',
    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count',
    'payroll_run_accrual', 'payroll_run_payment'
  ));

-- Extend voucher link source_type
ALTER TABLE accounting_voucher_links DROP CONSTRAINT IF EXISTS accounting_voucher_links_source_type_check;
ALTER TABLE accounting_voucher_links
  ADD CONSTRAINT accounting_voucher_links_source_type_check
  CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'payroll_run_brand_total', 'supplier', 'supplier_invoice'
  ));
