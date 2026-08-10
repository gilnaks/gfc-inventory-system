-- Receipt condition workflow: per-line damaged qty + PO received trigger update
-- Run manually in Supabase SQL editor.

ALTER TABLE delivery_receipt_items
  ADD COLUMN IF NOT EXISTS quantity_damaged DECIMAL(10,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_receipt_items_quantity_damaged_nonneg'
  ) THEN
    ALTER TABLE delivery_receipt_items
      ADD CONSTRAINT delivery_receipt_items_quantity_damaged_nonneg
      CHECK (quantity_damaged >= 0);
  END IF;
END $$;

-- PO cumulative received includes good + damaged (both count toward supplier invoice match)
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

ALTER TABLE accounting_voucher_settings
  ADD COLUMN IF NOT EXISTS default_damaged_goods_account_id UUID
  REFERENCES accounting_accounts(id) ON DELETE SET NULL;
