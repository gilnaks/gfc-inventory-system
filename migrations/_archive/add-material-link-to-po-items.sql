-- =============================================
-- LINK PURCHASE ORDER ITEMS TO RAW MATERIALS
-- =============================================
-- This migration adds material tracking to purchase orders
-- so that deliveries automatically update raw materials inventory

-- Add material_id column to purchase_order_items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_order_items' AND column_name = 'material_id'
  ) THEN
    ALTER TABLE purchase_order_items 
    ADD COLUMN material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_po_items_material_id ON purchase_order_items(material_id);
    
    RAISE NOTICE 'Added material_id column to purchase_order_items';
  END IF;
END $$;

-- =============================================
-- CREATE MATERIAL STOCK MOVEMENTS FROM DELIVERIES
-- =============================================
-- This trigger automatically creates material stock movements
-- when delivery receipt items are recorded, updating raw materials inventory

CREATE OR REPLACE FUNCTION create_material_movement_from_delivery()
RETURNS TRIGGER AS $$
DECLARE
  po_item_record RECORD;
  delivery_record RECORD;
  po_record RECORD;
  material_record RECORD;
  stock_per_purchase INTEGER;
  stock_qty DECIMAL(10,2);
  po_unit TEXT;
  purchase_unit TEXT;
  stock_unit TEXT;
BEGIN
  SELECT * INTO po_item_record
  FROM purchase_order_items
  WHERE id = NEW.po_item_id;

  IF po_item_record.material_id IS NULL THEN
    RAISE NOTICE 'PO item % is not linked to a raw material, skipping stock movement', NEW.po_item_id;
    RETURN NEW;
  END IF;

  SELECT * INTO material_record
  FROM raw_materials
  WHERE id = po_item_record.material_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Material % not found for PO item %, skipping stock movement',
      po_item_record.material_id, NEW.po_item_id;
    RETURN NEW;
  END IF;

  stock_per_purchase := GREATEST(1, FLOOR(COALESCE(material_record.uom_stock_per_purchase, 1)));

  po_unit := LOWER(TRIM(COALESCE(po_item_record.unit, '')));
  purchase_unit := LOWER(TRIM(COALESCE(NULLIF(TRIM(material_record.uom_purchase_unit), ''), material_record.unit, '')));
  stock_unit := LOWER(TRIM(COALESCE(material_record.unit, '')));

  IF stock_per_purchase > 1
     AND po_unit <> ''
     AND stock_unit <> ''
     AND po_unit = stock_unit
     AND (purchase_unit = '' OR po_unit IS DISTINCT FROM purchase_unit) THEN
    stock_qty := NEW.quantity_received;
  ELSE
    stock_qty := NEW.quantity_received * stock_per_purchase;
  END IF;

  SELECT * INTO delivery_record
  FROM delivery_receipts
  WHERE id = NEW.delivery_receipt_id;

  SELECT * INTO po_record
  FROM purchase_orders
  WHERE id = delivery_record.po_id;

  INSERT INTO material_stock_movements (
    material_id,
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
    po_item_record.material_id,
    'in',
    stock_qty,
    po_item_record.unit_price,
    'delivery_receipt',
    NEW.delivery_receipt_id,
    delivery_record.receipt_number,
    'Received from PO: ' || po_record.po_number ||
    ' (' || NEW.quantity_received::TEXT || ' ' || COALESCE(po_item_record.unit, '') || ')' ||
    CASE
      WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes
      ELSE ''
    END,
    delivery_record.delivery_date,
    delivery_record.received_by
  );

  RAISE NOTICE 'Created material stock movement for material % (purchase qty: %, stock qty: %)',
    po_item_record.material_id, NEW.quantity_received, stock_qty;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_create_material_movement_from_delivery ON delivery_receipt_items;
CREATE TRIGGER trigger_create_material_movement_from_delivery
  AFTER INSERT ON delivery_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION create_material_movement_from_delivery();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Purchase orders can now update raw materials inventory';
  RAISE NOTICE 'When delivery receipt items are recorded, raw materials stock will automatically update';
END $$;
