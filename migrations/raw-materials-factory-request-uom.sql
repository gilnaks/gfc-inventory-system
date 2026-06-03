-- Factory material requests: qty in purchase or stock unit (when linked to factory).

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS factory_request_uom VARCHAR(20);

ALTER TABLE raw_materials
  DROP CONSTRAINT IF EXISTS raw_materials_factory_request_uom_check;

ALTER TABLE raw_materials
  ADD CONSTRAINT raw_materials_factory_request_uom_check
  CHECK (factory_request_uom IS NULL OR factory_request_uom IN ('purchase', 'stock'));

UPDATE raw_materials
SET factory_request_uom = 'stock'
WHERE factory_inventory_kind IS NOT NULL
  AND (factory_request_uom IS NULL OR factory_request_uom NOT IN ('purchase', 'stock'));

UPDATE raw_materials
SET factory_request_uom = NULL
WHERE factory_inventory_kind IS NULL;
