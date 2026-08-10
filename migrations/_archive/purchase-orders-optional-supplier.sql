-- Allow purchase orders without a linked supplier
ALTER TABLE purchase_orders
  ALTER COLUMN supplier_id DROP NOT NULL;
