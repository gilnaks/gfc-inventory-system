-- Consolidate books under GFC Main: franchise as reporting dimension.
-- Journals/vouchers stay on books brand_id (GFC); franchise_brand_id tags performance.

ALTER TABLE accounting_journal_entries
  ADD COLUMN IF NOT EXISTS franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE accounting_journal_lines
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

ALTER TABLE accounting_vouchers
  ADD COLUMN IF NOT EXISTS franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE accounting_voucher_lines
  ADD COLUMN IF NOT EXISTS franchise_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_journal_franchise_date
  ON accounting_journal_entries(brand_id, franchise_brand_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_franchise
  ON accounting_journal_lines(franchise_brand_id)
  WHERE franchise_brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_location
  ON accounting_journal_lines(location_id)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_franchise
  ON accounting_vouchers(brand_id, franchise_brand_id);
