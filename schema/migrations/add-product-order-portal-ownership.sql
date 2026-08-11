-- Per-product order portal visibility by location ownership.
-- Default both TRUE = visible to company-owned and franchise branches.
-- "Company owned only" → available_to_company_owned=true, available_to_franchise=false
-- "Franchise only"     → available_to_company_owned=false, available_to_franchise=true

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS available_to_company_owned BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS available_to_franchise BOOLEAN NOT NULL DEFAULT TRUE;

-- Must DROP first: CREATE OR REPLACE cannot insert/rename middle columns.
DROP VIEW IF EXISTS inventory_summary;

CREATE VIEW inventory_summary AS
SELECT
  p.id AS product_id,
  p.brand_id,
  p.name AS product_name,
  p.sku,
  p.category,
  p.unit,
  COALESCE(p.price, 0.00) AS price,
  COALESCE(p.initial_stock, 0) AS initial_stock,
  COALESCE(p.production, 0) AS production,
  COALESCE(p.released, 0) AS released,
  COALESCE(p.reserved, 0) AS reserved,
  b.name AS brand_name,
  b.slug AS brand_slug,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0)) AS final_stock,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0) - COALESCE(p.reserved, 0)) AS available_stock,
  p.created_at,
  p.updated_at,
  COALESCE(p.available_to_company_owned, TRUE) AS available_to_company_owned,
  COALESCE(p.available_to_franchise, TRUE) AS available_to_franchise
FROM products p
JOIN brands b ON p.brand_id = b.id;
