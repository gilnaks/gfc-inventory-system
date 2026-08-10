-- Procurement inventory / fixed-asset GL posting support



-- 5910 Inventory Variance for existing brands (skip if already present)

INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)

SELECT b.id, '5910', 'Inventory Variance / Shrinkage', 'expense', 'debit', true

FROM brands b

WHERE NOT EXISTS (

  SELECT 1 FROM accounting_accounts a

  WHERE a.brand_id = b.id AND a.code = '5910'

);



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



ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;

ALTER TABLE accounting_journal_entries

  ADD CONSTRAINT accounting_journal_entries_source_type_check

  CHECK (source_type IN (

    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',

    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',

    'opening_balance', 'year_end_close',

    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count'

  ));

