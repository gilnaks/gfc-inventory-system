-- Per-location ice cream store inventory (true stock) + movement ledger for DSIR.

CREATE TABLE IF NOT EXISTS dsir_store_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  flavor VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, flavor)
);

CREATE INDEX IF NOT EXISTS idx_dsir_store_inventory_location
  ON dsir_store_inventory (location_id);

CREATE INDEX IF NOT EXISTS idx_dsir_store_inventory_brand
  ON dsir_store_inventory (brand_id);

CREATE TABLE IF NOT EXISTS dsir_store_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  flavor VARCHAR(100) NOT NULL,
  delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  movement_type VARCHAR(40) NOT NULL
    CHECK (movement_type IN ('transfer_receive', 'dsir_pull_out', 'cycle_count')),
  staff_registration_id UUID REFERENCES staff_registrations(id) ON DELETE SET NULL,
  staff_name TEXT,
  dsir_report_id UUID REFERENCES dsir_reports(id) ON DELETE SET NULL,
  source_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_source_key
  ON dsir_store_inventory_movements (location_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_location_created
  ON dsir_store_inventory_movements (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dsir_store_inv_mov_report
  ON dsir_store_inventory_movements (dsir_report_id)
  WHERE dsir_report_id IS NOT NULL;

ALTER TABLE dsir_store_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dsir_store_inventory"
  ON dsir_store_inventory FOR ALL USING (true);

ALTER TABLE dsir_store_inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dsir_store_inventory_movements"
  ON dsir_store_inventory_movements FOR ALL USING (true);
