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
BEGIN
  -- Get the PO item details including material_id
  SELECT * INTO po_item_record 
  FROM purchase_order_items 
  WHERE id = NEW.po_item_id;
  
  -- Only proceed if the PO item is linked to a raw material
  IF po_item_record.material_id IS NULL THEN
    RAISE NOTICE 'PO item % is not linked to a raw material, skipping stock movement', NEW.po_item_id;
    RETURN NEW;
  END IF;
  
  -- Get delivery receipt details
  SELECT * INTO delivery_record
  FROM delivery_receipts
  WHERE id = NEW.delivery_receipt_id;
  
  -- Get PO details
  SELECT * INTO po_record
  FROM purchase_orders
  WHERE id = delivery_record.po_id;
  
  -- Create material stock movement (type 'in' for receiving materials)
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
    NEW.quantity_received,
    po_item_record.unit_price,
    'delivery_receipt',
    NEW.delivery_receipt_id,
    delivery_record.receipt_number,
    'Received from PO: ' || po_record.po_number || 
    CASE 
      WHEN NEW.notes IS NOT NULL THEN ' - ' || NEW.notes
      ELSE ''
    END,
    delivery_record.delivery_date,
    delivery_record.received_by
  );
  
  RAISE NOTICE 'Created material stock movement for material % (quantity: %)', 
    po_item_record.material_id, NEW.quantity_received;
  
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
