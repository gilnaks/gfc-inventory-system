-- Category-level order portal visibility by location ownership
-- (mirrors product-level flags; both default TRUE = all branches).

ALTER TABLE product_category_sort
  ADD COLUMN IF NOT EXISTS available_to_company_owned BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS available_to_franchise BOOLEAN NOT NULL DEFAULT TRUE;
