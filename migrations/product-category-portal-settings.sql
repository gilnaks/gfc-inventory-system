-- Order portal visibility + remote-store category flags (on product_category_sort).
-- Run after migrations/product-category-sort.sql.

ALTER TABLE product_category_sort
  ADD COLUMN IF NOT EXISTS show_on_order_portal BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE product_category_sort
  ADD COLUMN IF NOT EXISTS remote_store BOOLEAN NOT NULL DEFAULT FALSE;

-- SELECT category_name, show_on_order_portal, remote_store FROM product_category_sort;
