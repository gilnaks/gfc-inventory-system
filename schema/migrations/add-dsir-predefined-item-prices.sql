-- Effective-dated sales prices for DSIR predefined items.
-- Replaces legacy_price: history ranges drive old reports; current open range
-- syncs dsir_predefined_items.price for new drafts/snapshots.

CREATE TABLE IF NOT EXISTS dsir_predefined_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predefined_item_id UUID NOT NULL REFERENCES dsir_predefined_items(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_dsir_predefined_item_prices_item_from
  ON dsir_predefined_item_prices (predefined_item_id, effective_from);

DROP TRIGGER IF EXISTS update_dsir_predefined_item_prices_updated_at ON dsir_predefined_item_prices;
CREATE TRIGGER update_dsir_predefined_item_prices_updated_at
  BEFORE UPDATE ON dsir_predefined_item_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE dsir_predefined_item_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on dsir_predefined_item_prices" ON dsir_predefined_item_prices;
CREATE POLICY "Allow all on dsir_predefined_item_prices" ON dsir_predefined_item_prices
  FOR ALL USING (true);

-- Seed one open-ended range per sales item: current price from earliest DSIR date.
INSERT INTO dsir_predefined_item_prices (predefined_item_id, price, effective_from, effective_to)
SELECT
  i.id,
  COALESCE(i.price, 0),
  COALESCE(
    (
      SELECT MIN(r.report_date)
      FROM dsir_reports r
      INNER JOIN locations loc ON loc.id = r.location_id
      WHERE loc.brand_id = i.brand_id
    ),
    CURRENT_DATE
  ),
  NULL
FROM dsir_predefined_items i
WHERE i.category = 'sales'
  AND i.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM dsir_predefined_item_prices p WHERE p.predefined_item_id = i.id
  );

-- Remove short-lived legacy_price column if present.
ALTER TABLE dsir_predefined_items DROP COLUMN IF EXISTS legacy_price;
