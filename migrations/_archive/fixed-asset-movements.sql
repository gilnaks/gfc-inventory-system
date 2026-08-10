-- Fixed asset quantity change history (mirrors material_stock_movements)

CREATE TABLE IF NOT EXISTS fixed_asset_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fixed_asset_movement_type_check CHECK (movement_type IN ('in', 'out', 'adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_fixed_asset_movements_asset ON fixed_asset_movements(fixed_asset_id);
CREATE INDEX IF NOT EXISTS idx_fixed_asset_movements_date ON fixed_asset_movements(movement_date);

ALTER TABLE fixed_asset_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fixed_asset_movements" ON fixed_asset_movements;
CREATE POLICY "Allow all on fixed_asset_movements" ON fixed_asset_movements FOR ALL USING (true);

-- Apply quantity changes from movement rows
CREATE OR REPLACE FUNCTION update_fixed_asset_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE fixed_assets
    SET
      quantity = COALESCE(quantity, 0) + NEW.quantity,
      unit_cost = CASE
        WHEN NEW.unit_cost IS NOT NULL AND NEW.unit_cost > 0 THEN NEW.unit_cost
        ELSE unit_cost
      END,
      updated_at = NOW()
    WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE fixed_assets
    SET quantity = COALESCE(quantity, 0) - NEW.quantity, updated_at = NOW()
    WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE fixed_assets
    SET quantity = COALESCE(quantity, 0) + NEW.quantity, updated_at = NOW()
    WHERE id = NEW.fixed_asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fixed_asset_quantity ON fixed_asset_movements;
CREATE TRIGGER trigger_update_fixed_asset_quantity
  AFTER INSERT ON fixed_asset_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_fixed_asset_quantity();

-- PO delivery: record movement instead of direct quantity update
CREATE OR REPLACE FUNCTION apply_fixed_asset_from_delivery()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  delivery_record RECORD;
  po_record RECORD;
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
  SELECT * INTO po_record FROM purchase_orders WHERE id = delivery_record.po_id;

  INSERT INTO fixed_asset_movements (
    fixed_asset_id,
    movement_type,
    quantity,
    unit_cost,
    reference_type,
    reference_id,
    reference_number,
    notes,
    movement_date,
    created_by
  ) VALUES (
    po_item_record.fixed_asset_id,
    'in',
    NEW.quantity_received,
    po_item_record.unit_price,
    'delivery_receipt',
    NEW.delivery_receipt_id,
    delivery_record.receipt_number,
    'Received from PO: ' || po_record.po_number ||
      CASE WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes ELSE '' END,
    delivery_record.delivery_date,
    delivery_record.received_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
