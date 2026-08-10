-- Track when a deposit slip was uploaded (separate from order created_at / status updated_at)

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS deposit_slip_uploaded_at TIMESTAMPTZ;

-- Best-effort backfill for existing slips (upload flow also sets updated_at at upload time)
UPDATE customer_orders
SET deposit_slip_uploaded_at = updated_at
WHERE deposit_slip_url IS NOT NULL
  AND deposit_slip_uploaded_at IS NULL;
