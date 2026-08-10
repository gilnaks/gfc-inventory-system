-- GFC Factory Rollout — Phase 2 optional material copy + BOM rewire mapping

CREATE TABLE IF NOT EXISTS gfc_material_legacy_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  gfc_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  legacy_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(legacy_material_id)
);

CREATE INDEX IF NOT EXISTS idx_gfc_material_legacy_gfc ON gfc_material_legacy_mapping(gfc_material_id);

-- Copy active plant materials from retail brands → GFC (run once after gfc-factory-rollout.sql)
-- Skips materials already mapped. Does not migrate stock movements.
INSERT INTO raw_materials (
  brand_id, supplier_id, material_name, sku, category, unit,
  uom_base_unit, uom_base_per_unit, uom_purchase_unit, uom_stock_per_purchase,
  unit_cost, minimum_stock, current_stock, notes, is_active, owner,
  factory_inventory_kind, factory_request_uom, factory_bom_uom, linked_product_id
)
SELECT
  gfc.id,
  rm.supplier_id, rm.material_name, rm.sku, rm.category, rm.unit,
  rm.uom_base_unit, rm.uom_base_per_unit, rm.uom_purchase_unit, rm.uom_stock_per_purchase,
  rm.unit_cost, rm.minimum_stock, 0, rm.notes, rm.is_active, rm.owner,
  rm.factory_inventory_kind, rm.factory_request_uom, rm.factory_bom_uom, rm.linked_product_id
FROM raw_materials rm
JOIN brands rb ON rb.id = rm.brand_id AND rb.brand_role = 'retail'
JOIN brands gfc ON gfc.slug = 'gfc'
WHERE rm.is_active = true
  AND rm.factory_inventory_kind IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM gfc_material_legacy_mapping m WHERE m.legacy_material_id = rm.id
  );

INSERT INTO gfc_material_legacy_mapping (legacy_material_id, gfc_material_id, legacy_brand_id)
SELECT rm.id, new_rm.id, rm.brand_id
FROM raw_materials rm
JOIN brands rb ON rb.id = rm.brand_id AND rb.brand_role = 'retail'
JOIN brands gfc ON gfc.slug = 'gfc'
JOIN raw_materials new_rm ON new_rm.brand_id = gfc.id
  AND new_rm.material_name = rm.material_name
  AND COALESCE(new_rm.sku, '') = COALESCE(rm.sku, '')
  AND new_rm.current_stock = 0
WHERE rm.is_active = true
  AND rm.factory_inventory_kind IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM gfc_material_legacy_mapping m WHERE m.legacy_material_id = rm.id
  );

-- Rewire active BOM lines to GFC materials
UPDATE product_bom_items pbi
SET material_id = m.gfc_material_id
FROM gfc_material_legacy_mapping m
JOIN product_bom_items existing ON existing.material_id = m.legacy_material_id
WHERE pbi.id = existing.id;

-- Deactivate legacy retail plant materials (stock remains for depletion)
UPDATE raw_materials rm
SET is_active = false
FROM gfc_material_legacy_mapping m
WHERE rm.id = m.legacy_material_id;

ALTER TABLE gfc_material_legacy_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on gfc_material_legacy_mapping" ON gfc_material_legacy_mapping;
CREATE POLICY "Allow all on gfc_material_legacy_mapping" ON gfc_material_legacy_mapping FOR ALL USING (true);
