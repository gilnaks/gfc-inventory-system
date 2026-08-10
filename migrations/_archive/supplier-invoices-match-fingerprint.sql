-- Fingerprint + matched timestamp for stale 3-way match detection

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS match_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_exception
  ON supplier_invoices(brand_id, status)
  WHERE status = 'exception';