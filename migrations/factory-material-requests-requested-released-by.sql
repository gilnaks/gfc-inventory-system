-- Track who requested and who released factory material requests (replaces notes for audit)

ALTER TABLE factory_material_requests
  ADD COLUMN IF NOT EXISTS requested_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS released_by VARCHAR(100);

UPDATE factory_material_requests
SET requested_by = NULLIF(TRIM(notes), '')
WHERE requested_by IS NULL
  AND notes IS NOT NULL
  AND TRIM(notes) <> '';
