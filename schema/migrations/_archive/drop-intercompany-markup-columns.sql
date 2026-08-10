-- Intercompany transfers are at cost only; remove unused markup columns.

ALTER TABLE accounting_voucher_settings
  DROP COLUMN IF EXISTS intercompany_default_markup_percent,
  DROP COLUMN IF EXISTS default_intercompany_markup_percent,
  DROP COLUMN IF EXISTS default_intercompany_markup_account_id;

ALTER TABLE intercompany_brand_settings
  DROP COLUMN IF EXISTS default_markup_percent;

ALTER TABLE intercompany_transfers
  DROP COLUMN IF EXISTS markup_percent;
