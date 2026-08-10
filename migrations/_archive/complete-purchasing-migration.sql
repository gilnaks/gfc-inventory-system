-- =============================================
-- COMPLETE PURCHASING SYSTEM MIGRATION
-- Safe to run multiple times - includes existence checks
-- =============================================
-- 
-- This migration adds:
-- ✅ Supplier management
-- ✅ Purchase requisitions (PR)
-- ✅ Quotations (RFQ ready)
-- ✅ Purchase orders (PO)
-- ✅ Payments tracking
-- ✅ Delivery receipts
-- ✅ Raw materials inventory
-- ✅ Stock movements
-- ✅ Automated calculations
-- =============================================

-- =============================================
-- 1. SUPPLIERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  payment_terms VARCHAR(50),
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. PURCHASE REQUISITIONS
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_number VARCHAR(50) NOT NULL UNIQUE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  requested_by VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pr_status_check'
  ) THEN
    ALTER TABLE purchase_requisitions 
    ADD CONSTRAINT pr_status_check CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'converted'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_requisition_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  estimated_price DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. QUOTATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number VARCHAR(50) NOT NULL UNIQUE,
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_status_check'
  ) THEN
    ALTER TABLE quotations 
    ADD CONSTRAINT quotation_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. PURCHASE ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  purchasing_agent VARCHAR(100) NOT NULL,
  approved_by VARCHAR(100),
  approved_date DATE,
  payment_terms VARCHAR(50),
  payment_method VARCHAR(20),
  payment_timing VARCHAR(20) NOT NULL DEFAULT 'after_delivery',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) DEFAULT 0,
  delivery_address TEXT,
  delivery_contact VARCHAR(100),
  delivery_phone VARCHAR(20),
  po_attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_payment_method_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT po_payment_method_check CHECK (payment_method IN ('cash', 'check', 'bank_transfer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_payment_timing_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT po_payment_timing_check CHECK (payment_timing IN ('before_delivery', 'after_delivery', 'partial'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'po_status_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT po_status_check CHECK (status IN ('draft', 'pending_approval', 'approved', 'order_confirmed', 'in_transit', 'delivered', 'paid', 'closed', 'cancelled'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  pr_item_id UUID REFERENCES purchase_requisition_items(id) ON DELETE SET NULL,
  product_description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  quantity_received DECIMAL(10,2) DEFAULT 0,
  quantity_remaining DECIMAL(10,2) GENERATED ALWAYS AS (quantity - COALESCE(quantity_received, 0)) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS po_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type VARCHAR(20) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  check_number VARCHAR(50),
  bank_name VARCHAR(100),
  reference_number VARCHAR(100),
  proof_of_payment_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_type_check') THEN
    ALTER TABLE po_payments ADD CONSTRAINT payment_type_check CHECK (payment_type IN ('advance', 'partial', 'full', 'final'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_method_check') THEN
    ALTER TABLE po_payments ADD CONSTRAINT payment_method_check CHECK (payment_method IN ('cash', 'check', 'bank_transfer'));
  END IF;
END $$;

-- =============================================
-- 6. DELIVERY RECEIPTS
-- =============================================
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by VARCHAR(100) NOT NULL,
  condition VARCHAR(20) DEFAULT 'good',
  notes TEXT,
  delivery_receipt_url TEXT,
  inspection_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_condition_check') THEN
    ALTER TABLE delivery_receipts ADD CONSTRAINT delivery_condition_check CHECK (condition IN ('good', 'damaged', 'partial', 'incomplete'));
  END IF;
END $$;

-- Update constraint if it already exists (for existing installations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_condition_check') THEN
    ALTER TABLE delivery_receipts DROP CONSTRAINT IF EXISTS delivery_condition_check;
    ALTER TABLE delivery_receipts ADD CONSTRAINT delivery_condition_check CHECK (condition IN ('good', 'damaged', 'partial', 'incomplete'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_receipt_id UUID NOT NULL REFERENCES delivery_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity_received DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 7. PO STATUS HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS po_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 8. RAW MATERIALS INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS raw_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  material_name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  minimum_stock DECIMAL(10,2) DEFAULT 0,
  current_stock DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand_id, material_name)
);

-- Add supplier_id column if it doesn't exist (for existing installations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'raw_materials' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE raw_materials ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================
-- 9. MATERIAL STOCK MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS material_stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  notes TEXT,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movement_type_check') THEN
    ALTER TABLE material_stock_movements ADD CONSTRAINT movement_type_check CHECK (movement_type IN ('in', 'out', 'adjustment'));
  END IF;
END $$;

-- =============================================
-- 10. MATERIAL STOCK ALERTS
-- =============================================
CREATE TABLE IF NOT EXISTS material_stock_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  alert_type VARCHAR(20) NOT NULL,
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alert_type_check') THEN
    ALTER TABLE material_stock_alerts ADD CONSTRAINT alert_type_check CHECK (alert_type IN ('low_stock', 'out_of_stock', 'overstock'));
  END IF;
END $$;

-- =============================================
-- 11. INDEXES FOR PERFORMANCE
-- =============================================

-- Suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- Purchase Requisitions
CREATE INDEX IF NOT EXISTS idx_pr_number ON purchase_requisitions(pr_number);
CREATE INDEX IF NOT EXISTS idx_pr_brand_id ON purchase_requisitions(brand_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_pr_request_date ON purchase_requisitions(request_date);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr_id ON purchase_requisition_items(pr_id);

-- Purchase Orders
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_brand_id ON purchase_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id);

-- Quotations
CREATE INDEX IF NOT EXISTS idx_quotations_supplier_id ON quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_brand_id ON quotations(brand_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_po_payments_po_id ON po_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_date ON po_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_po_payments_number ON po_payments(payment_number);

-- Delivery Receipts
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_po_id ON delivery_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_date ON delivery_receipts(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_receipt_items_receipt_id ON delivery_receipt_items(delivery_receipt_id);

-- Raw Materials
CREATE INDEX IF NOT EXISTS idx_raw_materials_brand_id ON raw_materials(brand_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier_id ON raw_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active ON raw_materials(is_active);
CREATE INDEX IF NOT EXISTS idx_material_movements_material_id ON material_stock_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_date ON material_stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_material_movements_type ON material_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_material_alerts_material_id ON material_stock_alerts(material_id);
CREATE INDEX IF NOT EXISTS idx_material_alerts_resolved ON material_stock_alerts(is_resolved);

-- =============================================
-- 12. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stock_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for demo purposes)
DROP POLICY IF EXISTS "Allow all operations on suppliers" ON suppliers;
CREATE POLICY "Allow all operations on suppliers" ON suppliers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on purchase_requisitions" ON purchase_requisitions;
CREATE POLICY "Allow all operations on purchase_requisitions" ON purchase_requisitions FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on purchase_requisition_items" ON purchase_requisition_items;
CREATE POLICY "Allow all operations on purchase_requisition_items" ON purchase_requisition_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on quotations" ON quotations;
CREATE POLICY "Allow all operations on quotations" ON quotations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on quotation_items" ON quotation_items;
CREATE POLICY "Allow all operations on quotation_items" ON quotation_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on purchase_orders" ON purchase_orders;
CREATE POLICY "Allow all operations on purchase_orders" ON purchase_orders FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on purchase_order_items" ON purchase_order_items;
CREATE POLICY "Allow all operations on purchase_order_items" ON purchase_order_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on po_payments" ON po_payments;
CREATE POLICY "Allow all operations on po_payments" ON po_payments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on delivery_receipts" ON delivery_receipts;
CREATE POLICY "Allow all operations on delivery_receipts" ON delivery_receipts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on delivery_receipt_items" ON delivery_receipt_items;
CREATE POLICY "Allow all operations on delivery_receipt_items" ON delivery_receipt_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on po_status_history" ON po_status_history;
CREATE POLICY "Allow all operations on po_status_history" ON po_status_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on raw_materials" ON raw_materials;
CREATE POLICY "Allow all operations on raw_materials" ON raw_materials FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on material_stock_movements" ON material_stock_movements;
CREATE POLICY "Allow all operations on material_stock_movements" ON material_stock_movements FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on material_stock_alerts" ON material_stock_alerts;
CREATE POLICY "Allow all operations on material_stock_alerts" ON material_stock_alerts FOR ALL USING (true);

-- =============================================
-- 13. TRIGGERS FOR UPDATED_AT
-- =============================================

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_requisitions_updated_at ON purchase_requisitions;
CREATE TRIGGER update_purchase_requisitions_updated_at BEFORE UPDATE ON purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_po_payments_updated_at ON po_payments;
CREATE TRIGGER update_po_payments_updated_at BEFORE UPDATE ON po_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_receipts_updated_at ON delivery_receipts;
CREATE TRIGGER update_delivery_receipts_updated_at BEFORE UPDATE ON delivery_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_raw_materials_updated_at ON raw_materials;
CREATE TRIGGER update_raw_materials_updated_at BEFORE UPDATE ON raw_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 14. AUTOMATED BUSINESS LOGIC FUNCTIONS
-- =============================================

-- Function to update PO totals when items change
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET 
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM purchase_order_items
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM purchase_order_items
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    ),
    balance_amount = (
      SELECT COALESCE(SUM(total_price), 0) - COALESCE((
        SELECT SUM(amount)
        FROM po_payments
        WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
      ), 0)
      FROM purchase_order_items
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    )
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_totals_insert ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_insert
AFTER INSERT ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_po_totals();

DROP TRIGGER IF EXISTS trigger_update_po_totals_update ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_update
AFTER UPDATE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_po_totals();

DROP TRIGGER IF EXISTS trigger_update_po_totals_delete ON purchase_order_items;
CREATE TRIGGER trigger_update_po_totals_delete
AFTER DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION update_po_totals();

-- Function to update PO balance when payment is made
CREATE OR REPLACE FUNCTION update_po_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM po_payments
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    ),
    balance_amount = total_amount - (
      SELECT COALESCE(SUM(amount), 0)
      FROM po_payments
      WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    )
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_balance_insert ON po_payments;
CREATE TRIGGER trigger_update_po_balance_insert
AFTER INSERT ON po_payments
FOR EACH ROW EXECUTE FUNCTION update_po_balance();

DROP TRIGGER IF EXISTS trigger_update_po_balance_update ON po_payments;
CREATE TRIGGER trigger_update_po_balance_update
AFTER UPDATE ON po_payments
FOR EACH ROW EXECUTE FUNCTION update_po_balance();

DROP TRIGGER IF EXISTS trigger_update_po_balance_delete ON po_payments;
CREATE TRIGGER trigger_update_po_balance_delete
AFTER DELETE ON po_payments
FOR EACH ROW EXECUTE FUNCTION update_po_balance();

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_po_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO po_status_history (po_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.purchasing_agent, 
            'Status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_po_status ON purchase_orders;
CREATE TRIGGER trigger_log_po_status
AFTER UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION log_po_status_change();

-- Function to update quantity received in PO items
CREATE OR REPLACE FUNCTION update_po_item_received()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_order_items
  SET quantity_received = COALESCE(quantity_received, 0) + NEW.quantity_received
  WHERE id = NEW.po_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_po_item_received ON delivery_receipt_items;
CREATE TRIGGER trigger_update_po_item_received
AFTER INSERT ON delivery_receipt_items
FOR EACH ROW EXECUTE FUNCTION update_po_item_received();

-- Function to update material stock when movement recorded
CREATE OR REPLACE FUNCTION update_material_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE raw_materials
    SET 
      current_stock = current_stock + NEW.quantity,
      unit_cost = CASE 
        WHEN NEW.unit_cost IS NOT NULL THEN NEW.unit_cost 
        ELSE unit_cost 
      END
    WHERE id = NEW.material_id;
  ELSIF NEW.movement_type = 'out' THEN
    UPDATE raw_materials
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.material_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE raw_materials
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_material_stock ON material_stock_movements;
CREATE TRIGGER trigger_update_material_stock
  AFTER INSERT ON material_stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_material_stock();

-- Function to check for low stock and create alerts
CREATE OR REPLACE FUNCTION check_material_stock_level()
RETURNS TRIGGER AS $$
DECLARE
  material_record RECORD;
BEGIN
  SELECT * INTO material_record FROM raw_materials WHERE id = NEW.material_id;
  
  IF material_record.current_stock <= material_record.minimum_stock AND material_record.current_stock > 0 THEN
    INSERT INTO material_stock_alerts (material_id, alert_type, alert_date)
    SELECT NEW.material_id, 'low_stock', CURRENT_DATE
    WHERE NOT EXISTS (
      SELECT 1 FROM material_stock_alerts 
      WHERE material_id = NEW.material_id 
      AND alert_type = 'low_stock' 
      AND is_resolved = FALSE
    );
  ELSIF material_record.current_stock <= 0 THEN
    INSERT INTO material_stock_alerts (material_id, alert_type, alert_date)
    SELECT NEW.material_id, 'out_of_stock', CURRENT_DATE
    WHERE NOT EXISTS (
      SELECT 1 FROM material_stock_alerts 
      WHERE material_id = NEW.material_id 
      AND alert_type = 'out_of_stock' 
      AND is_resolved = FALSE
    );
  ELSE
    UPDATE material_stock_alerts
    SET is_resolved = TRUE, resolved_date = CURRENT_DATE
    WHERE material_id = NEW.material_id 
    AND alert_type IN ('low_stock', 'out_of_stock')
    AND is_resolved = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_material_stock_level ON material_stock_movements;
CREATE TRIGGER trigger_check_material_stock_level
  AFTER INSERT ON material_stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION check_material_stock_level();

-- =============================================
-- 15. USEFUL VIEWS
-- =============================================

-- View for materials with stock status
DROP VIEW IF EXISTS materials_stock_view;
CREATE VIEW materials_stock_view AS
SELECT 
  rm.id,
  rm.brand_id,
  rm.supplier_id,
  rm.material_name,
  rm.sku,
  rm.category,
  rm.unit,
  rm.unit_cost,
  rm.minimum_stock,
  rm.current_stock,
  rm.is_active,
  b.name as brand_name,
  s.name as supplier_name,
  CASE 
    WHEN rm.current_stock <= 0 THEN 'out_of_stock'
    WHEN rm.current_stock <= rm.minimum_stock THEN 'low_stock'
    WHEN rm.current_stock > rm.minimum_stock * 3 THEN 'overstock'
    ELSE 'normal'
  END as stock_status,
  rm.current_stock * rm.unit_cost as stock_value,
  rm.created_at,
  rm.updated_at
FROM raw_materials rm
JOIN brands b ON rm.brand_id = b.id
LEFT JOIN suppliers s ON rm.supplier_id = s.id;

-- View for PO summary with supplier info
DROP VIEW IF EXISTS po_summary_view;
CREATE VIEW po_summary_view AS
SELECT 
  po.id,
  po.po_number,
  po.brand_id,
  b.name as brand_name,
  po.supplier_id,
  s.name as supplier_name,
  po.order_date,
  po.expected_delivery_date,
  po.status,
  po.total_amount,
  po.paid_amount,
  po.balance_amount,
  po.payment_timing,
  COUNT(poi.id) as item_count,
  po.created_at
FROM purchase_orders po
JOIN suppliers s ON po.supplier_id = s.id
JOIN brands b ON po.brand_id = b.id
LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
GROUP BY po.id, b.name, s.name;

-- =============================================
-- 16. SAMPLE DATA
-- =============================================

-- Insert sample suppliers (only if they don't exist)
INSERT INTO suppliers (name, contact_person, phone, payment_terms, is_active) 
SELECT * FROM (
  VALUES 
    ('Nutriasia', 'Maria Santos', '02-1234-5678', '30 days after delivery', TRUE),
    ('Manila Trading Co.', 'Juan Dela Cruz', '02-8765-4321', 'Payment upon order', TRUE),
    ('Global Supplies Inc.', 'Ana Garcia', '0917-123-4567', '15 days after delivery', TRUE)
) AS v(name, contact_person, phone, payment_terms, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE suppliers.name = v.name
);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- This migration is safe to run multiple times
-- All operations use IF NOT EXISTS or DROP IF EXISTS
-- Existing data will be preserved
--
-- What was installed:
-- ✅ 14 tables with relationships
-- ✅ 2 views for reporting
-- ✅ 6 automated functions
-- ✅ All indexes and constraints
-- ✅ RLS policies
-- ✅ Sample suppliers
--
-- Next steps:
-- 1. Verify installation: SELECT count(*) FROM suppliers;
-- 2. Access Purchasing tab in your app
-- 3. Select a brand
-- 4. Start using the system!

