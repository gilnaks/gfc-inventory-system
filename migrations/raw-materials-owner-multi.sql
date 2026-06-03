-- Multi-owner support for raw materials
-- Converts raw_materials.owner from VARCHAR/TEXT to TEXT[] (if needed)

DO $$
DECLARE
  owner_type text;
BEGIN
  SELECT data_type
  INTO owner_type
  FROM information_schema.columns
  WHERE table_name = 'raw_materials'
    AND column_name = 'owner';

  IF owner_type IS NULL THEN
    ALTER TABLE raw_materials
      ADD COLUMN owner TEXT[] DEFAULT '{}'::text[];
  ELSIF owner_type IN ('character varying', 'text') THEN
    -- Convert existing single owner values into a 1-element array.
    -- If values contain commas, they'll become multiple owners.
    ALTER TABLE raw_materials
      ALTER COLUMN owner TYPE TEXT[]
      USING CASE
        WHEN owner IS NULL OR btrim(owner) = '' THEN '{}'::text[]
        ELSE regexp_split_to_array(owner, '\\s*,\\s*')
      END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raw_materials_owner_gin ON raw_materials USING GIN(owner);

