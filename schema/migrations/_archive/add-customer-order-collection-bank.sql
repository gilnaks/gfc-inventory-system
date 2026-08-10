-- Bank account used when posting customer order cash collection (AR clearance).
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS collection_bank_account_id UUID REFERENCES accounting_bank_accounts(id) ON DELETE SET NULL;
