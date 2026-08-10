-- Fixed assets register (separate from raw materials inventory)
CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  asset_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT 'unit',
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  location VARCHAR(200),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, asset_name)
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_brand ON fixed_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_supplier ON fixed_assets(supplier_id);

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fixed_assets" ON fixed_assets;
CREATE POLICY "Allow all on fixed_assets" ON fixed_assets FOR ALL USING (true);

-- Link PO lines to fixed assets (mutually exclusive with material_id in app logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_order_items' AND column_name = 'fixed_asset_id'
  ) THEN
    ALTER TABLE purchase_order_items
    ADD COLUMN fixed_asset_id UUID REFERENCES fixed_assets(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_po_items_fixed_asset_id ON purchase_order_items(fixed_asset_id);
  END IF;
END $$;

-- On delivery: add received qty to fixed assets register (not materials stock)
CREATE OR REPLACE FUNCTION apply_fixed_asset_from_delivery()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  delivery_record RECORD;
BEGIN
  SELECT * INTO po_item_record FROM purchase_order_items WHERE id = NEW.po_item_id;

  IF po_item_record.fixed_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF po_item_record.material_id IS NOT NULL THEN
    RAISE NOTICE 'PO item % has both material and fixed_asset; skipping fixed asset receipt', NEW.po_item_id;
    RETURN NEW;
  END IF;

  SELECT * INTO delivery_record FROM delivery_receipts WHERE id = NEW.delivery_receipt_id;

  UPDATE fixed_assets
  SET
    quantity = COALESCE(quantity, 0) + NEW.quantity_received,
    unit_cost = CASE
      WHEN po_item_record.unit_price > 0 THEN po_item_record.unit_price
      ELSE unit_cost
    END,
    updated_at = NOW()
  WHERE id = po_item_record.fixed_asset_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_apply_fixed_asset_from_delivery ON delivery_receipt_items;
CREATE TRIGGER trigger_apply_fixed_asset_from_delivery
  AFTER INSERT ON delivery_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION apply_fixed_asset_from_delivery();
