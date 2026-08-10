-- Proof of payment (bank transfer screenshot, check image, etc.) when marking a PV paid.
ALTER TABLE accounting_vouchers
  ADD COLUMN IF NOT EXISTS proof_of_payment_url TEXT;
