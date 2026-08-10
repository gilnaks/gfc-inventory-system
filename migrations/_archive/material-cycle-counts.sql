-- Cycle counts for raw materials warehouse inventory (procurement / materials tab).

CREATE TABLE IF NOT EXISTS material_cycle_counts (
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

CREATE TABLE IF NOT EXISTS material_cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES material_cycle_counts(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  /** System on-hand in stock units when the count was started. */
  system_stock NUMERIC(12, 2) NOT NULL,
  /** Physical count in stock units; NULL until entered. */
  counted_stock NUMERIC(12, 2),
  notes TEXT,
  adjustment_movement_id UUID REFERENCES material_stock_movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_count_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_cycle_counts_brand_date
  ON material_cycle_counts (brand_id, count_date DESC);

CREATE INDEX IF NOT EXISTS idx_material_cycle_count_lines_count
  ON material_cycle_count_lines (cycle_count_id);

ALTER TABLE material_cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_cycle_count_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on material_cycle_counts" ON material_cycle_counts;
CREATE POLICY "Allow all on material_cycle_counts" ON material_cycle_counts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on material_cycle_count_lines" ON material_cycle_count_lines;
CREATE POLICY "Allow all on material_cycle_count_lines" ON material_cycle_count_lines FOR ALL USING (true);
