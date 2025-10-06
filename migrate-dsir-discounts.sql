-- Migration script to update dsir_discounts table with new schema
-- Run this in your Supabase SQL editor

-- First, let's check what columns currently exist
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'dsir_discounts' 
-- ORDER BY ordinal_position;

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add name column (rename from discount_type if it exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'name') THEN
        -- Check if discount_type exists and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'discount_type') THEN
            ALTER TABLE dsir_discounts RENAME COLUMN discount_type TO name;
        ELSE
            ALTER TABLE dsir_discounts ADD COLUMN name VARCHAR(100);
        END IF;
    END IF;

    -- Add id_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'id_type') THEN
        ALTER TABLE dsir_discounts ADD COLUMN id_type VARCHAR(20) CHECK (id_type IN ('senior', 'pwd'));
    END IF;

    -- Add id_no column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'id_no') THEN
        ALTER TABLE dsir_discounts ADD COLUMN id_no VARCHAR(50);
    END IF;

    -- Add attach_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'attach_url') THEN
        ALTER TABLE dsir_discounts ADD COLUMN attach_url TEXT;
    END IF;

    -- Add order_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'order_type') THEN
        ALTER TABLE dsir_discounts ADD COLUMN order_type VARCHAR(20);
    END IF;

    -- Add order_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'order_amount') THEN
        ALTER TABLE dsir_discounts ADD COLUMN order_amount DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add discount_amount column (computed column)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'discount_amount') THEN
        ALTER TABLE dsir_discounts ADD COLUMN discount_amount DECIMAL(10,2) GENERATED ALWAYS AS (order_amount * 0.2) STORED;
    END IF;

    -- Update existing records to have default values
    UPDATE dsir_discounts 
    SET 
        name = COALESCE(name, ''),
        id_type = COALESCE(id_type, 'senior'),
        order_amount = COALESCE(order_amount, 0)
    WHERE name IS NULL OR id_type IS NULL OR order_amount IS NULL;

    -- Make name and id_type NOT NULL after setting defaults
    ALTER TABLE dsir_discounts ALTER COLUMN name SET NOT NULL;
    ALTER TABLE dsir_discounts ALTER COLUMN id_type SET NOT NULL;
    ALTER TABLE dsir_discounts ALTER COLUMN order_amount SET NOT NULL;

    -- Remove old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'description') THEN
        ALTER TABLE dsir_discounts DROP COLUMN description;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'amount') THEN
        ALTER TABLE dsir_discounts DROP COLUMN amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'id_number') THEN
        ALTER TABLE dsir_discounts DROP COLUMN id_number;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'attachment') THEN
        ALTER TABLE dsir_discounts DROP COLUMN attachment;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dsir_discounts' AND column_name = 'order_details') THEN
        ALTER TABLE dsir_discounts DROP COLUMN order_details;
    END IF;

END $$;

-- Verify the new structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'dsir_discounts' 
ORDER BY ordinal_position;
