-- Add UOM hierarchy fields for raw materials:
-- purchase_uom -> unit(stock_uom) -> base_uom

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'uom_base_unit'
  ) THEN
    ALTER TABLE raw_materials ADD COLUMN uom_base_unit VARCHAR(50);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'uom_base_per_unit'
  ) THEN
    ALTER TABLE raw_materials ADD COLUMN uom_base_per_unit DECIMAL(12,4) DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'uom_purchase_unit'
  ) THEN
    ALTER TABLE raw_materials ADD COLUMN uom_purchase_unit VARCHAR(50);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'raw_materials' AND column_name = 'uom_stock_per_purchase'
  ) THEN
    ALTER TABLE raw_materials ADD COLUMN uom_stock_per_purchase DECIMAL(12,4) DEFAULT 1;
  END IF;
END $$;

UPDATE raw_materials
SET
  uom_base_unit = COALESCE(NULLIF(TRIM(uom_base_unit), ''), unit),
  uom_base_per_unit = COALESCE(uom_base_per_unit, 1),
  uom_purchase_unit = COALESCE(NULLIF(TRIM(uom_purchase_unit), ''), unit),
  uom_stock_per_purchase = COALESCE(uom_stock_per_purchase, 1);
