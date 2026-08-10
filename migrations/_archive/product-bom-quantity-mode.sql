-- BOM lines: quantity per finished unit, or per production batch with yield.

ALTER TABLE product_bom_items
  ADD COLUMN IF NOT EXISTS quantity_mode TEXT NOT NULL DEFAULT 'unit';

ALTER TABLE product_bom_items
  DROP CONSTRAINT IF EXISTS product_bom_items_quantity_mode_check;

ALTER TABLE product_bom_items
  ADD CONSTRAINT product_bom_items_quantity_mode_check
  CHECK (quantity_mode IN ('unit', 'batch'));

ALTER TABLE product_bom_items
  ADD COLUMN IF NOT EXISTS yield_per_batch DECIMAL(12, 4);

UPDATE product_bom_items
SET quantity_mode = 'unit'
WHERE quantity_mode IS NULL OR quantity_mode NOT IN ('unit', 'batch');
