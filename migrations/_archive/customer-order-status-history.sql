-- Customer order status change audit trail
CREATE TABLE IF NOT EXISTS customer_order_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_order_status_history_order_id
  ON customer_order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_order_status_history_created_at
  ON customer_order_status_history(created_at);

ALTER TABLE customer_order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on customer_order_status_history" ON customer_order_status_history;
CREATE POLICY "Allow all operations on customer_order_status_history"
  ON customer_order_status_history FOR ALL USING (true);
