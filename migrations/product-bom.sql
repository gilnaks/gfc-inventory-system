-- Bill of materials: links finished products to procurement raw materials
CREATE TABLE IF NOT EXISTS product_bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_product_bom_items_product ON product_bom_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_items_material ON product_bom_items(material_id);

ALTER TABLE product_bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on product_bom_items" ON product_bom_items;
CREATE POLICY "Allow all on product_bom_items" ON product_bom_items FOR ALL USING (true);
