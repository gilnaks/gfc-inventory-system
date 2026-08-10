-- Ensure delivery receipt lines update PO cumulative received quantities.

CREATE OR REPLACE FUNCTION update_po_item_received()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_order_items
  SET quantity_received = COALESCE(quantity_received, 0)
    + NEW.quantity_received + COALESCE(NEW.quantity_damaged, 0)
  WHERE id = NEW.po_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_item_received ON delivery_receipt_items;
CREATE TRIGGER trigger_update_po_item_received
  AFTER INSERT ON delivery_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_item_received();
