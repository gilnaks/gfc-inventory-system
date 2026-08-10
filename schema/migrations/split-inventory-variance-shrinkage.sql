-- Split Inventory Variance (5910) from Inventory Shrinkage (5920).
-- Existing combined "Inventory Variance / Shrinkage" accounts are renamed to Variance only.
-- Damaged-goods / shrinkage default maps to 5920 when unset or still shared with variance.

UPDATE accounting_accounts
SET name = 'Inventory Variance'
WHERE code = '5910'
  AND name ILIKE '%shrinkage%';

INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)
SELECT b.id, '5920', 'Inventory Shrinkage', 'expense', 'debit', true
FROM brands b
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_accounts a
  WHERE a.brand_id = b.id AND a.code = '5920'
);

UPDATE accounting_voucher_settings s
SET default_damaged_goods_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id
  AND a.code = '5920'
  AND (
    s.default_damaged_goods_account_id IS NULL
    OR s.default_damaged_goods_account_id = s.default_inventory_variance_account_id
  );

UPDATE accounting_voucher_settings s
SET default_inventory_variance_account_id = a.id
FROM accounting_accounts a
WHERE a.brand_id = s.brand_id
  AND a.code = '5910'
  AND s.default_inventory_variance_account_id IS NULL;
