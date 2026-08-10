-- Scope product cycle counts: NULL = main (non–index-0 categories), category name = index-0 category.

ALTER TABLE product_cycle_counts
  ADD COLUMN IF NOT EXISTS category_scope TEXT;

COMMENT ON COLUMN product_cycle_counts.category_scope IS
  'NULL = main cycle count (non index-0 categories). Set to category display name for index-0 category counts.';
