-- =============================================
-- DSIR (Daily Sales & Inventory Report) SCHEMA
-- Complete schema for staff registration and DSIR system
-- Handles both new installations and existing databases
-- =============================================

-- =============================================
-- 1. CREATE CORE TABLES
-- =============================================

-- Staff registration table - staff self-register here
CREATE TABLE IF NOT EXISTS staff_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  staff_code VARCHAR(8) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staff assignments table - franchisees assign staff to branches
CREATE TABLE IF NOT EXISTS staff_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  assigned_by_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_registration_id, location_id)
);

-- =============================================
-- 2. CREATE DSIR_REPORTS TABLE
-- =============================================

-- Main DSIR reports table
CREATE TABLE IF NOT EXISTS dsir_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  store_hours VARCHAR(50),
  staff_name VARCHAR(100),
  initial VARCHAR(10),
  
  -- Summary calculations
  gross_sales DECIMAL(10,2) DEFAULT 0,
  total_discounts DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  net_sales DECIMAL(10,2) DEFAULT 0,
  total_cash DECIMAL(10,2) DEFAULT 0,
  discrepancy DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, reviewed
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(location_id, report_date, staff_registration_id)
);

-- =============================================
-- 3. CREATE DSIR DETAIL TABLES
-- =============================================

-- Sales & Inventory Section (Section A)
CREATE TABLE IF NOT EXISTS dsir_sales_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  beginning_inventory INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  new_inventory INTEGER DEFAULT 0,
  ending_inventory INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  sales DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ice Cream Inventory Section (Section B)
CREATE TABLE IF NOT EXISTS dsir_ice_cream_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  flavor VARCHAR(50) NOT NULL,
  beginning INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  new_inventory INTEGER DEFAULT 0,
  ending INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  sales DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materials Inventory Section (Section C)
CREATE TABLE IF NOT EXISTS dsir_materials_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  material_name VARCHAR(100) NOT NULL,
  beginning INTEGER DEFAULT 0,
  arrival INTEGER DEFAULT 0,
  pull_out INTEGER DEFAULT 0,
  new_inventory INTEGER DEFAULT 0,
  ending INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discounts Section (Section D)
CREATE TABLE IF NOT EXISTS dsir_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  discount_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses Section (Section E)
CREATE TABLE IF NOT EXISTS dsir_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  expense_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Reconciliation Section (Section F)
CREATE TABLE IF NOT EXISTS dsir_sales_recon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
  denomination VARCHAR(20) NOT NULL,
  quantity INTEGER DEFAULT 0,
  amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on DSIR tables
ALTER TABLE staff_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_sales_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_ice_cream_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_materials_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_sales_recon ENABLE ROW LEVEL SECURITY;

-- Create policies for DSIR tables
DROP POLICY IF EXISTS "Allow all operations on staff_registrations" ON staff_registrations;
CREATE POLICY "Allow all operations on staff_registrations" ON staff_registrations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on staff_assignments" ON staff_assignments;
CREATE POLICY "Allow all operations on staff_assignments" ON staff_assignments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_reports" ON dsir_reports;
CREATE POLICY "Allow all operations on dsir_reports" ON dsir_reports FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_sales_inventory" ON dsir_sales_inventory;
CREATE POLICY "Allow all operations on dsir_sales_inventory" ON dsir_sales_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_ice_cream_inventory" ON dsir_ice_cream_inventory;
CREATE POLICY "Allow all operations on dsir_ice_cream_inventory" ON dsir_ice_cream_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_materials_inventory" ON dsir_materials_inventory;
CREATE POLICY "Allow all operations on dsir_materials_inventory" ON dsir_materials_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_discounts" ON dsir_discounts;
CREATE POLICY "Allow all operations on dsir_discounts" ON dsir_discounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_expenses" ON dsir_expenses;
CREATE POLICY "Allow all operations on dsir_expenses" ON dsir_expenses FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on dsir_sales_recon" ON dsir_sales_recon;
CREATE POLICY "Allow all operations on dsir_sales_recon" ON dsir_sales_recon FOR ALL USING (true);

-- =============================================
-- 5. INDEXES FOR PERFORMANCE
-- =============================================

-- Staff registrations indexes
CREATE INDEX IF NOT EXISTS idx_staff_registrations_staff_code ON staff_registrations(staff_code);
CREATE INDEX IF NOT EXISTS idx_staff_registrations_mobile_number ON staff_registrations(mobile_number);

-- Staff assignments indexes
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_registration_id ON staff_assignments(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_location_id ON staff_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_assigned_by_location_id ON staff_assignments(assigned_by_location_id);

-- DSIR reports indexes
CREATE INDEX IF NOT EXISTS idx_dsir_reports_location_id ON dsir_reports(location_id);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_date ON dsir_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_staff_registration_id ON dsir_reports(staff_registration_id);

-- DSIR detail tables indexes
CREATE INDEX IF NOT EXISTS idx_dsir_sales_inventory_report_id ON dsir_sales_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_ice_cream_inventory_report_id ON dsir_ice_cream_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_materials_inventory_report_id ON dsir_materials_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_discounts_report_id ON dsir_discounts(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_expenses_report_id ON dsir_expenses(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_sales_recon_report_id ON dsir_sales_recon(dsir_report_id);

-- =============================================
-- 6. TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all DSIR tables
CREATE TRIGGER update_staff_registrations_updated_at BEFORE UPDATE ON staff_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_reports_updated_at BEFORE UPDATE ON dsir_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_sales_inventory_updated_at BEFORE UPDATE ON dsir_sales_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_ice_cream_inventory_updated_at BEFORE UPDATE ON dsir_ice_cream_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_materials_inventory_updated_at BEFORE UPDATE ON dsir_materials_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_discounts_updated_at BEFORE UPDATE ON dsir_discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_expenses_updated_at BEFORE UPDATE ON dsir_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dsir_sales_recon_updated_at BEFORE UPDATE ON dsir_sales_recon FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. REALTIME CONFIGURATION
-- =============================================

-- Enable realtime for DSIR tables
DO $$
BEGIN
    -- Add DSIR tables to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE staff_registrations;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE staff_assignments;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_reports;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_sales_inventory;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_ice_cream_inventory;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_materials_inventory;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_discounts;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_expenses;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE dsir_sales_recon;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- =============================================
-- 8. SAMPLE DATA (OPTIONAL)
-- =============================================

-- Insert sample staff registration for testing
INSERT INTO staff_registrations (full_name, mobile_number, staff_code) 
VALUES ('Test Staff', '09123456789', '12345678')
ON CONFLICT (staff_code) DO NOTHING;

-- =============================================
-- SCHEMA COMPLETE
-- =============================================