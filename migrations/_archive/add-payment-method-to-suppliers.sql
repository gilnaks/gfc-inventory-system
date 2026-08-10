-- Add payment_method column to suppliers table
-- This allows storing the preferred payment method for each supplier

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS payment_method TEXT 
CHECK (payment_method IN ('cash', 'check', 'bank_transfer'));

-- Add a comment to describe the column
COMMENT ON COLUMN suppliers.payment_method IS 'Preferred payment method for this supplier (cash, check, or bank_transfer)';

-- Set a default value for existing records
UPDATE suppliers 
SET payment_method = 'bank_transfer' 
WHERE payment_method IS NULL;

