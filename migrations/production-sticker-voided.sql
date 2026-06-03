-- Void misprints / bad stickers without deleting audit history.

ALTER TABLE production_sticker_logs
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_voided_at
  ON production_sticker_logs(voided_at)
  WHERE voided_at IS NOT NULL;
