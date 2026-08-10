-- Per JE-source cash GL defaults (fallback remains default_cash_account_id).
ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_cash_customer_order_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_cash_payment_voucher_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_cash_payroll_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_cash_staff_advance_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL;
