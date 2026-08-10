-- Product-level BOM quantity basis (uniform for all materials on the product).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bom_quantity_mode TEXT NOT NULL DEFAULT 'unit';

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_bom_quantity_mode_check;

ALTER TABLE products
  ADD CONSTRAINT products_bom_quantity_mode_check
  CHECK (bom_quantity_mode IN ('unit', 'batch'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bom_yield_per_batch DECIMAL(12, 4);

UPDATE products
SET bom_quantity_mode = 'unit'
WHERE bom_quantity_mode IS NULL OR bom_quantity_mode NOT IN ('unit', 'batch');
