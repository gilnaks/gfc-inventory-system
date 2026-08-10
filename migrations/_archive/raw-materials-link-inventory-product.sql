-- Link raw materials to products for direct stock-unit selling
ALTER TABLE raw_materials
ADD COLUMN IF NOT EXISTS linked_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_raw_materials_linked_product_id
  ON raw_materials(linked_product_id);
