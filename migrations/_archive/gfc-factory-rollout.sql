-- GFC Factory Rollout (Option A) — Phase 1 foundation + brand_role

-- ---------------------------------------------------------------------------
-- Brand role: factory (GFC) vs retail (consumer brands)
-- ---------------------------------------------------------------------------
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS brand_role VARCHAR(20) NOT NULL DEFAULT 'retail'
    CHECK (brand_role IN ('factory', 'retail'));

-- GFC factory brand (idempotent)
INSERT INTO brands (name, slug, brand_role)
VALUES ('GFC Main', 'gfc', 'factory')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  brand_role = EXCLUDED.brand_role;

-- Ensure existing consumer brands stay retail
UPDATE brands SET brand_role = 'retail' WHERE slug IN ('gelatofilipino', 'mychoice', 'mang-sorbetes', 'mangsorbetes')
  AND brand_role IS DISTINCT FROM 'retail';

-- ---------------------------------------------------------------------------
-- Factory floor locations → payroll posts on GFC (Phase 3)
-- ---------------------------------------------------------------------------
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS is_factory_floor BOOLEAN NOT NULL DEFAULT false;

UPDATE locations
SET is_factory_floor = true
WHERE is_factory_floor = false
  AND (
    LOWER(COALESCE(name, '')) LIKE '%factory%'
    OR LOWER(COALESCE(name, '')) LIKE '%plant%'
    OR LOWER(COALESCE(name, '')) LIKE '%production%'
  );

-- ---------------------------------------------------------------------------
-- Intercompany COA extensions (all brands)
-- ---------------------------------------------------------------------------

-- GFC (factory) intercompany accounts
INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)
SELECT b.id, v.code, v.name, v.account_type, v.normal_balance, true
FROM brands b
CROSS JOIN (
  VALUES
    ('1111', 'Due from Gelatofilipino', 'asset', 'debit'),
    ('1112', 'Due from MyChoice', 'asset', 'debit'),
    ('1113', 'Due from Mang Sorbetes', 'asset', 'debit'),
    ('4510', 'Intercompany Sales', 'revenue', 'credit'),
    ('4520', 'Intercompany Markup Income', 'revenue', 'credit'),
    ('5510', 'Intercompany COGS', 'expense', 'debit')
) AS v(code, name, account_type, normal_balance)
WHERE b.slug = 'gfc'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_accounts a WHERE a.brand_id = b.id AND a.code = v.code
  );

-- Retail brand intercompany accounts
INSERT INTO accounting_accounts (brand_id, code, name, account_type, normal_balance, is_active)
SELECT b.id, v.code, v.name, v.account_type, v.normal_balance, true
FROM brands b
CROSS JOIN (
  VALUES
    ('2115', 'Due to GFC', 'liability', 'credit'),
    ('1210', 'Inventory from GFC', 'asset', 'debit')
) AS v(code, name, account_type, normal_balance)
WHERE b.brand_role = 'retail'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_accounts a WHERE a.brand_id = b.id AND a.code = v.code
  );

-- Voucher settings: intercompany defaults on GFC
ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_intercompany_sales_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_intercompany_cogs_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_intercompany_markup_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_due_to_gfc_account_id UUID
    REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_intercompany_markup_percent DECIMAL(6,2) DEFAULT 15.00;

UPDATE accounting_voucher_settings s
SET default_intercompany_sales_account_id = a.id
FROM accounting_accounts a
JOIN brands b ON b.id = a.brand_id
WHERE b.slug = 'gfc' AND a.code = '4510'
  AND s.brand_id = b.id AND s.default_intercompany_sales_account_id IS NULL;

UPDATE accounting_voucher_settings s
SET default_intercompany_cogs_account_id = a.id
FROM accounting_accounts a
JOIN brands b ON b.id = a.brand_id
WHERE b.slug = 'gfc' AND a.code = '5510'
  AND s.brand_id = b.id AND s.default_intercompany_cogs_account_id IS NULL;

UPDATE accounting_voucher_settings s
SET default_intercompany_markup_account_id = a.id
FROM accounting_accounts a
JOIN brands b ON b.id = a.brand_id
WHERE b.slug = 'gfc' AND a.code = '4520'
  AND s.brand_id = b.id AND s.default_intercompany_markup_account_id IS NULL;

UPDATE accounting_voucher_settings s
SET default_due_to_gfc_account_id = a.id
FROM accounting_accounts a
JOIN brands b ON b.id = a.brand_id
WHERE b.brand_role = 'retail' AND a.code = '2115'
  AND s.brand_id = b.id AND s.default_due_to_gfc_account_id IS NULL;

-- Per retail-brand due-from mapping on GFC books
CREATE TABLE IF NOT EXISTS intercompany_brand_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  retail_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  due_from_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  due_to_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  default_markup_percent DECIMAL(6,2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(factory_brand_id, retail_brand_id)
);

CREATE INDEX IF NOT EXISTS idx_intercompany_brand_settings_factory
  ON intercompany_brand_settings(factory_brand_id);

-- Seed GFC ↔ retail pair settings (due-from on GFC, due-to on retail)
INSERT INTO intercompany_brand_settings (factory_brand_id, retail_brand_id, due_from_account_id, due_to_account_id)
SELECT gfc.id, rb.id, ar.id, dt.id
FROM brands gfc
JOIN brands rb ON rb.brand_role = 'retail' AND rb.slug <> 'gfc'
LEFT JOIN accounting_accounts ar ON ar.brand_id = gfc.id AND ar.code = CASE rb.slug
  WHEN 'gelatofilipino' THEN '1111'
  WHEN 'mychoice' THEN '1112'
  WHEN 'mang-sorbetes' THEN '1113'
  WHEN 'mangsorbetes' THEN '1113'
  ELSE NULL
END
LEFT JOIN accounting_accounts dt ON dt.brand_id = rb.id AND dt.code = '2115'
WHERE gfc.slug = 'gfc'
ON CONFLICT (factory_brand_id, retail_brand_id) DO NOTHING;

-- GFC voucher company name
UPDATE accounting_voucher_settings s
SET company_name = 'GILNAKS FOOD CORPORATION'
FROM brands b
WHERE b.id = s.brand_id AND b.slug = 'gfc';

ALTER TABLE intercompany_brand_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on intercompany_brand_settings" ON intercompany_brand_settings;
CREATE POLICY "Allow all on intercompany_brand_settings" ON intercompany_brand_settings FOR ALL USING (true);
