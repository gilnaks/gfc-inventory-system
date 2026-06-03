-- Per-material unit for production schedule / factory BOM display (when linked to factory).

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS factory_bom_uom VARCHAR(20);

ALTER TABLE raw_materials
  DROP CONSTRAINT IF EXISTS raw_materials_factory_bom_uom_check;

ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_factory_bom_uom_check
  CHECK (factory_bom_uom IS NULL OR factory_bom_uom IN ('stock', 'base'));

UPDATE raw_materials
SET factory_bom_uom = 'base'
WHERE factory_inventory_kind IS NOT NULL
  AND (factory_bom_uom IS NULL OR factory_bom_uom NOT IN ('stock', 'base'));

UPDATE raw_materials
SET factory_bom_uom = NULL
WHERE factory_inventory_kind IS NULL;
