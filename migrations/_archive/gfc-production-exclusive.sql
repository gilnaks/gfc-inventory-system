-- GFC-only production: schedules on GFC catalog + destination brand tag

-- ---------------------------------------------------------------------------
-- production_schedules.for_brand_id (destination consumer brand)
-- ---------------------------------------------------------------------------
ALTER TABLE production_schedules
  ADD COLUMN IF NOT EXISTS for_brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT;

-- Backfill from product's retail brand before remapping product_id
UPDATE production_schedules ps
SET for_brand_id = p.brand_id
FROM products p
WHERE ps.product_id = p.id
  AND ps.for_brand_id IS NULL
  AND p.brand_id IN (SELECT id FROM brands WHERE brand_role = 'retail' OR slug <> 'gfc');

-- ---------------------------------------------------------------------------
-- GFC product catalog + retail mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gfc_product_retail_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gfc_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retail_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  retail_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(retail_brand_id, retail_product_id),
  UNIQUE(gfc_product_id, retail_brand_id)
);

CREATE INDEX IF NOT EXISTS idx_gfc_product_retail_mapping_gfc
  ON gfc_product_retail_mapping(gfc_product_id);

-- Copy retail FG products → GFC (zero stock; mapping per retail product)
-- Names/SKUs are disambiguated when the same label exists on another retail brand or on GFC.
WITH retail_fg AS (
  SELECT
    p.id AS retail_product_id,
    p.brand_id AS retail_brand_id,
    rb.slug AS retail_slug,
    rb.name AS retail_brand_name,
    p.name,
    p.sku,
    p.category,
    p.unit,
    p.price,
    p.minimum_stock,
    p.bom_quantity_mode,
    p.bom_yield_per_batch
  FROM products p
  JOIN brands rb ON rb.id = p.brand_id AND rb.brand_role = 'retail'
  WHERE NOT EXISTS (
    SELECT 1 FROM gfc_product_retail_mapping m WHERE m.retail_product_id = p.id
  )
),
with_gfc_labels AS (
  SELECT
    rf.*,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM retail_fg rf2
        WHERE rf2.name = rf.name AND rf2.retail_product_id <> rf.retail_product_id
      )
      OR EXISTS (
        SELECT 1 FROM products x
        JOIN brands gfc ON gfc.slug = 'gfc'
        WHERE x.brand_id = gfc.id AND x.name = rf.name
      )
      THEN COALESCE(rf.retail_brand_name, rf.retail_slug, 'Brand') || ' — ' || rf.name
      ELSE rf.name
    END AS gfc_name,
    CASE
      WHEN rf.sku IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1 FROM retail_fg rf2
        WHERE rf2.sku IS NOT NULL AND rf2.sku = rf.sku AND rf2.retail_product_id <> rf.retail_product_id
      )
      OR EXISTS (
        SELECT 1 FROM products x
        JOIN brands gfc ON gfc.slug = 'gfc'
        WHERE x.brand_id = gfc.id AND x.sku IS NOT NULL AND x.sku = rf.sku
      )
      THEN COALESCE(rf.retail_slug, 'brand') || '-' || rf.sku
      ELSE rf.sku
    END AS gfc_sku
  FROM retail_fg rf
),
inserted_gfc_products AS (
  INSERT INTO products (
    brand_id, name, sku, category, unit, price,
    initial_stock, production, released, reserved,
    minimum_stock, bom_quantity_mode, bom_yield_per_batch
  )
  SELECT
    gfc.id,
    w.gfc_name,
    w.gfc_sku,
    w.category,
    w.unit,
    COALESCE(w.price, 0),
    0, 0, 0, 0,
    COALESCE(w.minimum_stock, 0),
    w.bom_quantity_mode,
    w.bom_yield_per_batch
  FROM with_gfc_labels w
  CROSS JOIN brands gfc
  WHERE gfc.slug = 'gfc'
  RETURNING id, name, sku
)
INSERT INTO gfc_product_retail_mapping (gfc_product_id, retail_brand_id, retail_product_id, sku)
SELECT gp.id, w.retail_brand_id, w.retail_product_id, w.sku
FROM with_gfc_labels w
JOIN brands gfc ON gfc.slug = 'gfc'
JOIN inserted_gfc_products gp
  ON gp.name = w.gfc_name
  AND (gp.sku IS NOT DISTINCT FROM w.gfc_sku);

-- Copy BOM lines onto GFC products (remap materials via gfc_material_legacy_mapping when present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gfc_material_legacy_mapping'
  ) THEN
    INSERT INTO product_bom_items (product_id, material_id, quantity, quantity_mode, yield_per_batch, notes)
    SELECT
      m.gfc_product_id,
      COALESCE(lmap.gfc_material_id, bi.material_id),
      bi.quantity,
      bi.quantity_mode,
      bi.yield_per_batch,
      bi.notes
    FROM product_bom_items bi
    JOIN gfc_product_retail_mapping m ON m.retail_product_id = bi.product_id
    LEFT JOIN gfc_material_legacy_mapping lmap ON lmap.legacy_material_id = bi.material_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_bom_items x
      WHERE x.product_id = m.gfc_product_id
        AND x.material_id = COALESCE(lmap.gfc_material_id, bi.material_id)
    );
  ELSE
    INSERT INTO product_bom_items (product_id, material_id, quantity, quantity_mode, yield_per_batch, notes)
    SELECT
      m.gfc_product_id,
      bi.material_id,
      bi.quantity,
      bi.quantity_mode,
      bi.yield_per_batch,
      bi.notes
    FROM product_bom_items bi
    JOIN gfc_product_retail_mapping m ON m.retail_product_id = bi.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_bom_items x
      WHERE x.product_id = m.gfc_product_id AND x.material_id = bi.material_id
    );
  END IF;
END $$;

-- Remap existing schedules to GFC products
UPDATE production_schedules ps
SET
  product_id = m.gfc_product_id,
  for_brand_id = COALESCE(ps.for_brand_id, m.retail_brand_id)
FROM gfc_product_retail_mapping m
WHERE ps.product_id = m.retail_product_id;

-- Remap sticker logs to GFC products where schedule was retail
UPDATE production_sticker_logs sl
SET product_id = m.gfc_product_id
FROM gfc_product_retail_mapping m
WHERE sl.product_id = m.retail_product_id;

-- Remap factory production batches
UPDATE factory_production_batches b
SET product_id = m.gfc_product_id
FROM gfc_product_retail_mapping m
WHERE b.product_id = m.retail_product_id;

-- Unique constraint: same GFC product + date + destination brand
ALTER TABLE production_schedules DROP CONSTRAINT IF EXISTS production_schedules_product_id_schedule_date_key;
ALTER TABLE production_schedules DROP CONSTRAINT IF EXISTS production_schedules_product_id_schedule_date_for_brand_id_key;
ALTER TABLE production_schedules
  ADD CONSTRAINT production_schedules_product_id_schedule_date_for_brand_id_key
  UNIQUE (product_id, schedule_date, for_brand_id);

CREATE INDEX IF NOT EXISTS idx_production_schedules_for_brand_date
  ON production_schedules(for_brand_id, schedule_date);

-- ---------------------------------------------------------------------------
-- Production batch journal link
-- ---------------------------------------------------------------------------
ALTER TABLE factory_production_batches
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID
  REFERENCES accounting_journal_entries(id) ON DELETE SET NULL;

-- Journal source type
ALTER TABLE accounting_journal_entries DROP CONSTRAINT IF EXISTS accounting_journal_entries_source_type_check;
ALTER TABLE accounting_journal_entries
  ADD CONSTRAINT accounting_journal_entries_source_type_check
  CHECK (source_type IN (
    'manual', 'payment_voucher', 'petty_cash_voucher', 'customer_order_revenue',
    'customer_order_cash', 'customer_order_cogs', 'delivery_receipt', 'reversal',
    'opening_balance', 'year_end_close',
    'material_movement', 'fixed_asset_movement', 'material_cycle_count', 'product_cycle_count',
    'payroll_run_accrual', 'payroll_run_payment', 'intercompany_transfer', 'production_batch'
  ));

ALTER TABLE gfc_product_retail_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on gfc_product_retail_mapping" ON gfc_product_retail_mapping;
CREATE POLICY "Allow all on gfc_product_retail_mapping" ON gfc_product_retail_mapping FOR ALL USING (true);
