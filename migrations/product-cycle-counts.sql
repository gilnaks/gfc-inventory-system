-- Cycle counts for product inventory (finished goods per brand).

CREATE TABLE IF NOT EXISTS product_cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'posted', 'cancelled')),
  notes TEXT,
  created_by VARCHAR(100),
  posted_by VARCHAR(100),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES product_cycle_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  /** System available stock when the count was started. */
  system_available NUMERIC(12, 2) NOT NULL,
  /** Physical available count; NULL until entered. */
  counted_available NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_count_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_cycle_counts_brand_date
  ON product_cycle_counts (brand_id, count_date DESC);

CREATE INDEX IF NOT EXISTS idx_product_cycle_count_lines_count
  ON product_cycle_count_lines (cycle_count_id);

ALTER TABLE product_cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_cycle_count_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on product_cycle_counts" ON product_cycle_counts;
CREATE POLICY "Allow all on product_cycle_counts" ON product_cycle_counts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on product_cycle_count_lines" ON product_cycle_count_lines;
CREATE POLICY "Allow all on product_cycle_count_lines" ON product_cycle_count_lines FOR ALL USING (true);
