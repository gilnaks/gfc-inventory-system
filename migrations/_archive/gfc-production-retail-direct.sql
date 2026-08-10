-- GFC retail-direct production model:
-- - schedules/stickers/batches use retail product rows directly
-- - GFC no longer stores mirrored finished-goods product rows
-- - intercompany transfer lines may be posted without a source GFC product row
--
-- Safe to run when gfc-production-exclusive / gfc-material-legacy-mapping were never applied:
-- mapping-dependent steps are skipped if those tables do not exist.

-- ---------------------------------------------------------------------------
-- 1) Settings for automated intercompany markup
-- ---------------------------------------------------------------------------
ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS intercompany_default_markup_percent DECIMAL(6,2) NOT NULL DEFAULT 15;

-- ---------------------------------------------------------------------------
-- 2) Keep historical transfer lines valid after GFC catalog retirement
-- ---------------------------------------------------------------------------
ALTER TABLE intercompany_transfer_lines
  ALTER COLUMN source_product_id DROP NOT NULL;

ALTER TABLE intercompany_transfer_lines
  DROP CONSTRAINT IF EXISTS intercompany_transfer_lines_source_product_id_fkey;

ALTER TABLE intercompany_transfer_lines
  ADD CONSTRAINT intercompany_transfer_lines_source_product_id_fkey
  FOREIGN KEY (source_product_id) REFERENCES products(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3) Re-point retail product BOM lines to GFC material rows (when mapped)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gfc_material_legacy_mapping'
  ) THEN
    UPDATE product_bom_items pbi
    SET material_id = glm.gfc_material_id
    FROM products rp
    JOIN brands rb ON rb.id = rp.brand_id AND rb.brand_role = 'retail'
    JOIN gfc_material_legacy_mapping glm ON glm.legacy_material_id = pbi.material_id
    WHERE pbi.product_id = rp.id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Remap historical production rows from GFC product copies -> retail products
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gfc_product_retail_mapping'
  ) THEN
    UPDATE production_schedules ps
    SET
      product_id = m.retail_product_id,
      for_brand_id = COALESCE(ps.for_brand_id, m.retail_brand_id)
    FROM gfc_product_retail_mapping m
    WHERE ps.product_id = m.gfc_product_id;

    UPDATE production_sticker_logs sl
    SET product_id = m.retail_product_id
    FROM gfc_product_retail_mapping m
    WHERE sl.product_id = m.gfc_product_id;

    UPDATE factory_production_batches fpb
    SET product_id = m.retail_product_id
    FROM gfc_product_retail_mapping m
    WHERE fpb.product_id = m.gfc_product_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Ensure schedule rows always carry the retail destination brand
-- ---------------------------------------------------------------------------
UPDATE production_schedules ps
SET for_brand_id = p.brand_id
FROM products p
JOIN brands rb ON rb.id = p.brand_id AND rb.brand_role = 'retail'
WHERE ps.product_id = p.id
  AND (ps.for_brand_id IS NULL OR ps.for_brand_id <> p.brand_id);

-- keep uniqueness per retail product/date/destination
ALTER TABLE production_schedules
  DROP CONSTRAINT IF EXISTS production_schedules_product_id_schedule_date_key;

ALTER TABLE production_schedules
  DROP CONSTRAINT IF EXISTS production_schedules_product_id_schedule_date_for_brand_id_key;

ALTER TABLE production_schedules
  ADD CONSTRAINT production_schedules_product_id_schedule_date_for_brand_id_key
  UNIQUE (product_id, schedule_date, for_brand_id);

-- ---------------------------------------------------------------------------
-- 6) Move any held GFC FG balances to mapped retail product rows
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gfc_product_retail_mapping'
  ) THEN
    WITH moved AS (
      SELECT
        m.retail_product_id,
        SUM(COALESCE(gfc.production, 0))::INTEGER AS qty_to_move
      FROM gfc_product_retail_mapping m
      JOIN products gfc ON gfc.id = m.gfc_product_id
      GROUP BY m.retail_product_id
    )
    UPDATE products retail
    SET production = COALESCE(retail.production, 0) + moved.qty_to_move
    FROM moved
    WHERE retail.id = moved.retail_product_id
      AND moved.qty_to_move <> 0;

    UPDATE products gfc
    SET production = 0,
        initial_stock = 0,
        released = 0,
        reserved = 0
    FROM gfc_product_retail_mapping m
    WHERE gfc.id = m.gfc_product_id;

    DELETE FROM products p
    USING brands b
    WHERE p.brand_id = b.id
      AND b.slug = 'gfc'
      AND EXISTS (
        SELECT 1
        FROM gfc_product_retail_mapping m
        WHERE m.gfc_product_id = p.id
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Add batch link for idempotent auto transfer posting
-- ---------------------------------------------------------------------------
ALTER TABLE factory_production_batches
  ADD COLUMN IF NOT EXISTS intercompany_transfer_id UUID
  REFERENCES intercompany_transfers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 8) Retire mapping table (if it was created by gfc-production-exclusive)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS gfc_product_retail_mapping;
