-- Repair procurement posting migration if accounting-procurement-posting.sql failed partway.
-- Safe to run multiple times. Skips tables that do not exist yet.

ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_inventory_variance_account_id UUID
  REFERENCES accounting_accounts(id) ON DELETE SET NULL;

UPDATE accounting_voucher_settings s
SET default_inventory_variance_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id
  AND a.code = '5910'
  AND s.default_inventory_variance_account_id IS NULL;

ALTER TABLE material_stock_movements
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID
  REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fixed_asset_movements'
  ) THEN
    ALTER TABLE fixed_asset_movements
      ADD COLUMN IF NOT EXISTS journal_entry_id UUID
      REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'material_cycle_counts'
  ) THEN
    ALTER TABLE material_cycle_counts
      ADD COLUMN IF NOT EXISTS journal_entry_id UUID
      REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_cycle_counts'
  ) THEN
    ALTER TABLE product_cycle_counts
      ADD COLUMN IF NOT EXISTS journal_entry_id UUID
      REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;
  END IF;
END $$;
