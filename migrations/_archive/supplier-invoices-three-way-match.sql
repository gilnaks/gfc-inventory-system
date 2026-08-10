-- Supplier invoices for 3-way match (PO + receiving report + invoice)

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number VARCHAR(80) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  attachment_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'matched', 'exception', 'vouchered', 'paid')),
  match_summary JSONB,
  payment_voucher_id UUID REFERENCES accounting_vouchers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, supplier_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_brand ON supplier_invoices(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po ON supplier_invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity_invoiced DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  line_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_invoice ON supplier_invoice_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_po_item ON supplier_invoice_lines(po_item_id);

-- Extend accounting_voucher_links source_type to include supplier_invoice
ALTER TABLE accounting_voucher_links DROP CONSTRAINT IF EXISTS accounting_voucher_links_source_type_check;
ALTER TABLE accounting_voucher_links ADD CONSTRAINT accounting_voucher_links_source_type_check
  CHECK (source_type IN (
    'po_payment', 'purchase_order', 'delivery_receipt', 'customer_order',
    'payroll_deduction_refund', 'supplier', 'supplier_invoice'
  ));

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on supplier_invoices" ON supplier_invoices;
CREATE POLICY "Allow all on supplier_invoices" ON supplier_invoices FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on supplier_invoice_lines" ON supplier_invoice_lines;
CREATE POLICY "Allow all on supplier_invoice_lines" ON supplier_invoice_lines FOR ALL USING (true);

DROP TRIGGER IF EXISTS update_supplier_invoices_updated_at ON supplier_invoices;
CREATE TRIGGER update_supplier_invoices_updated_at
  BEFORE UPDATE ON supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for supplier invoice attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier_invoices', 'supplier_invoices', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public uploads to supplier_invoices bucket" ON storage.objects;
CREATE POLICY "Allow public uploads to supplier_invoices bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'supplier_invoices');

DROP POLICY IF EXISTS "Allow public reads from supplier_invoices bucket" ON storage.objects;
CREATE POLICY "Allow public reads from supplier_invoices bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'supplier_invoices');

DROP POLICY IF EXISTS "Allow public updates to supplier_invoices bucket" ON storage.objects;
CREATE POLICY "Allow public updates to supplier_invoices bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'supplier_invoices');

DROP POLICY IF EXISTS "Allow public deletes from supplier_invoices bucket" ON storage.objects;
CREATE POLICY "Allow public deletes from supplier_invoices bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'supplier_invoices');
