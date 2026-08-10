-- Add product-specific sales columns to dsir_reports table
-- This allows tracking sales for specific products like cups, water, and choco-coated items

ALTER TABLE dsir_reports 
ADD COLUMN IF NOT EXISTS big_cup_sales DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS small_cup_sales DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS water_sales DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ml_500_sales DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS choco_coated_sales DECIMAL(10,2) DEFAULT 0;

-- Add comments to describe the columns
COMMENT ON COLUMN dsir_reports.big_cup_sales IS 'Total sales for big cups';
COMMENT ON COLUMN dsir_reports.small_cup_sales IS 'Total sales for small cups';
COMMENT ON COLUMN dsir_reports.water_sales IS 'Total sales for water';
COMMENT ON COLUMN dsir_reports.ml_500_sales IS 'Total sales for 500mL products';
COMMENT ON COLUMN dsir_reports.choco_coated_sales IS 'Total sales for choco-coated products';

