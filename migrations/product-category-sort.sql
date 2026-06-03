-- Per-brand sort order for product inventory categories (dashboard)
CREATE TABLE IF NOT EXISTS product_category_sort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  show_on_order_portal BOOLEAN NOT NULL DEFAULT TRUE,
  remote_store BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, category_name)
);

CREATE INDEX IF NOT EXISTS idx_product_category_sort_brand ON product_category_sort(brand_id);

ALTER TABLE product_category_sort ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on product_category_sort" ON product_category_sort;
CREATE POLICY "Allow all on product_category_sort" ON product_category_sort FOR ALL USING (true);
