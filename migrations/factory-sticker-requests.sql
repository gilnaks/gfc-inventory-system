-- Factory floor requests for additional production stickers (damaged, lost, extras).
-- Pending requests appear in Production Schedule for admin to print.

CREATE TABLE IF NOT EXISTS factory_sticker_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES production_schedules(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  quantity_fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (quantity_fulfilled >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  requested_by TEXT,
  notes TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT factory_sticker_requests_fulfilled_lte_qty
    CHECK (quantity_fulfilled <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_factory_sticker_requests_schedule_date
  ON factory_sticker_requests(schedule_date);
CREATE INDEX IF NOT EXISTS idx_factory_sticker_requests_schedule_id
  ON factory_sticker_requests(schedule_id);
CREATE INDEX IF NOT EXISTS idx_factory_sticker_requests_status
  ON factory_sticker_requests(status);

ALTER TABLE factory_sticker_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on factory_sticker_requests" ON factory_sticker_requests;
CREATE POLICY "Allow all on factory_sticker_requests" ON factory_sticker_requests
  FOR ALL USING (true);
