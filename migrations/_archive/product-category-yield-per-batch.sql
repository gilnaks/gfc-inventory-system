-- Production schedule: 1 batch = N units of quantity_required (per category).
-- Run after migrations/product-category-sort.sql.

ALTER TABLE product_category_sort
  ADD COLUMN IF NOT EXISTS yield_per_batch NUMERIC(12, 2) NOT NULL DEFAULT 1;
