-- Link payment vouchers to operational bank accounts for reconciliation filtering.
ALTER TABLE accounting_vouchers
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON DELETE SET NULL;
