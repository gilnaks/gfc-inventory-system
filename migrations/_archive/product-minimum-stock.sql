-- Minimum stock level per product (inventory low-stock threshold)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.minimum_stock IS 'Minimum stock level; available qty below this shows as low stock (orange)';
