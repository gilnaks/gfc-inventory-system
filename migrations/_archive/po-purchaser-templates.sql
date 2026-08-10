-- Purchaser presets for purchase orders (per brand)

CREATE TABLE IF NOT EXISTS po_purchaser_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  purchasing_agent VARCHAR(100),
  payment_terms VARCHAR(50),
  payment_method VARCHAR(20),
  payment_timing VARCHAR(20) DEFAULT 'after_delivery',
  payment_account_name VARCHAR(200),
  payment_account_number VARCHAR(100),
  delivery_address TEXT,
  delivery_contact VARCHAR(100),
  delivery_phone VARCHAR(20),
  approved_by VARCHAR(100),
  approved_by_signatories TEXT[] DEFAULT '{}'::text[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_purchaser_templates_brand ON po_purchaser_templates(brand_id);

ALTER TABLE po_purchaser_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on po_purchaser_templates" ON po_purchaser_templates;
CREATE POLICY "Allow all on po_purchaser_templates" ON po_purchaser_templates FOR ALL USING (true);

-- Payment account details stored on each PO
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'payment_account_name'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN payment_account_name VARCHAR(200);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchase_orders' AND column_name = 'payment_account_number'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN payment_account_number VARCHAR(100);
  END IF;
END $$;

-- Approved-by signatory preset (for PO print signature block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_purchaser_templates' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE po_purchaser_templates ADD COLUMN approved_by VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_purchaser_templates' AND column_name = 'approved_by_signatories'
  ) THEN
    ALTER TABLE po_purchaser_templates ADD COLUMN approved_by_signatories TEXT[] DEFAULT '{}'::text[];
  END IF;
END $$;
