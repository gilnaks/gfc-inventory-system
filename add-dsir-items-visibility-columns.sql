-- Add local and remote visibility columns to dsir_predefined_items table
-- These columns control whether items show in local or remote DSIR reports

DO $$
BEGIN
    -- Check and add show_in_local column to dsir_predefined_items table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_predefined_items' AND column_name = 'show_in_local') THEN
        ALTER TABLE dsir_predefined_items ADD COLUMN show_in_local BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Check and add show_in_remote column to dsir_predefined_items table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_predefined_items' AND column_name = 'show_in_remote') THEN
        ALTER TABLE dsir_predefined_items ADD COLUMN show_in_remote BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Update existing records to set default values
UPDATE dsir_predefined_items SET show_in_local = TRUE WHERE show_in_local IS NULL;
UPDATE dsir_predefined_items SET show_in_remote = TRUE WHERE show_in_remote IS NULL;

-- Add comments
COMMENT ON COLUMN dsir_predefined_items.show_in_local IS 'Controls whether this item appears in local DSIR reports';
COMMENT ON COLUMN dsir_predefined_items.show_in_remote IS 'Controls whether this item appears in remote DSIR reports';
