-- Adds the fixed_asset_movements feature to live (table + quantity trigger + index).
-- Purely additive and idempotent. Matches canonical-schema.sql.

CREATE TABLE IF NOT EXISTS fixed_asset_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by VARCHAR(100),
  journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_fixed_asset_quantity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE fixed_assets
    SET quantity = COALESCE(quantity, 0) + NEW.quantity,
        unit_cost = CASE WHEN NEW.unit_cost IS NOT NULL AND NEW.unit_cost > 0 THEN NEW.unit_cost ELSE unit_cost END,
        updated_at = NOW()
    WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE fixed_assets SET quantity = COALESCE(quantity, 0) - NEW.quantity, updated_at = NOW() WHERE id = NEW.fixed_asset_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE fixed_assets SET quantity = COALESCE(quantity, 0) + NEW.quantity, updated_at = NOW() WHERE id = NEW.fixed_asset_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fixed_asset_quantity ON fixed_asset_movements;
CREATE TRIGGER trigger_update_fixed_asset_quantity AFTER INSERT ON fixed_asset_movements FOR EACH ROW EXECUTE FUNCTION update_fixed_asset_quantity();

CREATE INDEX IF NOT EXISTS idx_fixed_asset_movements_asset ON fixed_asset_movements(fixed_asset_id);

ALTER TABLE fixed_asset_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on fixed_asset_movements" ON fixed_asset_movements;
CREATE POLICY "Allow all on fixed_asset_movements" ON fixed_asset_movements FOR ALL USING (true);
