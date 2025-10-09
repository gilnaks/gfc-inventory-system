-- Add is_remote column to locations table
-- This column indicates whether a branch is a remote location

DO $$
BEGIN
    -- Check and add is_remote column to locations table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'is_remote') THEN
        ALTER TABLE locations ADD COLUMN is_remote BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update existing records to set default value
UPDATE locations SET is_remote = FALSE WHERE is_remote IS NULL;

COMMENT ON COLUMN locations.is_remote IS 'Indicates if the branch is a remote location';

