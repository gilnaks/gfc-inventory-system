-- Global DSIR store-inventory feature flags (singleton row).
-- pullouts_enabled=false skips posting/validating ice cream pull-outs on DSIR submit.

CREATE TABLE IF NOT EXISTS dsir_store_inventory_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pullouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_dsir_store_inventory_settings_updated_at ON dsir_store_inventory_settings;
CREATE TRIGGER update_dsir_store_inventory_settings_updated_at
  BEFORE UPDATE ON dsir_store_inventory_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE dsir_store_inventory_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on dsir_store_inventory_settings" ON dsir_store_inventory_settings;
CREATE POLICY "Allow all on dsir_store_inventory_settings" ON dsir_store_inventory_settings
  FOR ALL USING (true);

INSERT INTO dsir_store_inventory_settings (id, pullouts_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;
