-- Manual supplier lead time (days) for procurement
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_suppliers_lead_time_days ON suppliers(lead_time_days);

