-- Per-branch sales incentive thresholds (NULL = use system defaults)
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS incentive_regular_sales_threshold DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS incentive_holiday_sales_threshold DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS incentive_base_amount DECIMAL(12, 2);
