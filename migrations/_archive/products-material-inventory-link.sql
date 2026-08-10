-- Supplies/consumables (category sort index 0): link product inventory to materials inventory

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS linked_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS material_inventory_uom VARCHAR(20);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_material_inventory_uom_check;

ALTER TABLE products
  ADD CONSTRAINT products_material_inventory_uom_check
  CHECK (material_inventory_uom IS NULL OR material_inventory_uom IN ('purchase', 'stock'));

CREATE INDEX IF NOT EXISTS idx_products_linked_material_id ON products(linked_material_id);

COMMENT ON COLUMN products.linked_material_id IS 'For supplies/consumables: source row in materials inventory';
COMMENT ON COLUMN products.material_inventory_uom IS 'UOM when receiving from materials inventory: purchase or stock';
