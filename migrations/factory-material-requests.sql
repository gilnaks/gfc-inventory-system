-- Factory requests raw materials from procurement; released via Dashboard → Procurement → Raw Materials

CREATE TABLE IF NOT EXISTS factory_material_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
  notes TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_material_requests_status ON factory_material_requests(status);
CREATE INDEX IF NOT EXISTS idx_factory_material_requests_request_date ON factory_material_requests(request_date);

ALTER TABLE factory_material_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on factory_material_requests" ON factory_material_requests;
CREATE POLICY "Allow all on factory_material_requests" ON factory_material_requests FOR ALL USING (true);
