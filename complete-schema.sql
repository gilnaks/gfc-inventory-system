-- Complete Multi-Brand Inventory & Order Management System Schema
-- Run this single file in your Supabase SQL Editor to set up everything

-- =============================================
-- 1. CORE TABLES
-- =============================================

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table with quantity fields
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  unit VARCHAR(50) DEFAULT 'pcs',
  price DECIMAL(10,2) DEFAULT 0.00,
  initial_stock INTEGER DEFAULT 0,
  production INTEGER DEFAULT 0,
  released INTEGER DEFAULT 0,
  reserved INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand_id, name),
  UNIQUE(brand_id, sku)
);

-- Locations table for customer orders
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  passkey VARCHAR(6) NOT NULL UNIQUE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  franchisee VARCHAR(100),
  contact_number VARCHAR(20),
  company_owned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer orders table
CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_name VARCHAR(100),
  customer_contact VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, released, paid, complete, cancelled
  total_amount DECIMAL(10,2) DEFAULT 0,
  delivery_type VARCHAR(10) NOT NULL DEFAULT 'delivery', -- delivery, pickup
  deposit_slip_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logistics assignments table
CREATE TABLE IF NOT EXISTS logistics_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot VARCHAR(10) NOT NULL CHECK (time_slot IN ('morning', 'afternoon')),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, date, time_slot) -- Prevent double booking
);

-- Order details table
CREATE TABLE IF NOT EXISTS order_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily stock summaries table for tracking finalized stock days
CREATE TABLE IF NOT EXISTS daily_stock_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_production INTEGER DEFAULT 0,
  total_released INTEGER DEFAULT 0,
  total_final_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand_id, date)
);

-- =============================================
-- 2. VIEWS
-- =============================================

-- Inventory summary view with computed columns
-- First, ensure the products table has the required columns
DO $$
BEGIN
    -- Add quantity columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'initial_stock') THEN
        ALTER TABLE products ADD COLUMN initial_stock INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'production') THEN
        ALTER TABLE products ADD COLUMN production INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'released') THEN
        ALTER TABLE products ADD COLUMN released INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'reserved') THEN
        ALTER TABLE products ADD COLUMN reserved INTEGER DEFAULT 0;
    END IF;
END $$;

-- Check and add brand_id column to locations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'brand_id') THEN
        ALTER TABLE locations ADD COLUMN brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Check and add price column to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
        ALTER TABLE products ADD COLUMN price DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Check and add category column to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE products ADD COLUMN category VARCHAR(100);
    END IF;
END $$;

-- Check and add franchisee column to locations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'franchisee') THEN
        ALTER TABLE locations ADD COLUMN franchisee VARCHAR(100);
    END IF;
END $$;

-- Check and add contact_number column to locations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'contact_number') THEN
        ALTER TABLE locations ADD COLUMN contact_number VARCHAR(20);
    END IF;
END $$;

-- Check and add company_owned column to locations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'company_owned') THEN
        ALTER TABLE locations ADD COLUMN company_owned BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Check and add deposit_slip_url column to customer_orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_orders' AND column_name = 'deposit_slip_url') THEN
        ALTER TABLE customer_orders ADD COLUMN deposit_slip_url TEXT;
    END IF;
END $$;

-- Check and add delivery_type column to customer_orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_orders' AND column_name = 'delivery_type') THEN
        ALTER TABLE customer_orders ADD COLUMN delivery_type VARCHAR(10) NOT NULL DEFAULT 'delivery';
    END IF;
END $$;

-- Drop existing view if it exists, then create the new one
DROP VIEW IF EXISTS inventory_summary;

-- Create the view after ensuring columns exist
CREATE VIEW inventory_summary AS
SELECT 
  p.id as product_id,
  p.brand_id,
  p.name as product_name,
  p.sku,
  p.category,
  p.unit,
  COALESCE(p.price, 0.00) as price,
  COALESCE(p.initial_stock, 0) as initial_stock,
  COALESCE(p.production, 0) as production,
  COALESCE(p.released, 0) as released,
  COALESCE(p.reserved, 0) as reserved,
  b.name as brand_name,
  b.slug as brand_slug,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0)) as final_stock,
  (COALESCE(p.initial_stock, 0) + COALESCE(p.production, 0) - COALESCE(p.released, 0) - COALESCE(p.reserved, 0)) as available_stock,
  p.created_at,
  p.updated_at
FROM products p
JOIN brands b ON p.brand_id = b.id;

-- =============================================
-- 3. SAMPLE DATA
-- =============================================

-- Insert sample brands (handle existing brands gracefully)
INSERT INTO brands (name, slug) VALUES 
('Mychoice', 'mychoice'),
('Gelatofilipino', 'gelatofilipino'),
('Mang Sorbetes', 'mang-sorbetes')
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for timestamp updates (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_orders_updated_at ON customer_orders;
CREATE TRIGGER update_customer_orders_updated_at BEFORE UPDATE ON customer_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for demo purposes)
-- In production, you should create more restrictive policies based on your authentication system

DROP POLICY IF EXISTS "Allow all operations on brands" ON brands;
CREATE POLICY "Allow all operations on brands" ON brands FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on products" ON products;
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on locations" ON locations;
CREATE POLICY "Allow all operations on locations" ON locations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on customer_orders" ON customer_orders;
CREATE POLICY "Allow all operations on customer_orders" ON customer_orders FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on order_details" ON order_details;
CREATE POLICY "Allow all operations on order_details" ON order_details FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on daily_stock_summaries" ON daily_stock_summaries;
CREATE POLICY "Allow all operations on daily_stock_summaries" ON daily_stock_summaries FOR ALL USING (true);

-- =============================================
-- 6. INDEXES FOR PERFORMANCE
-- =============================================

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_customer_orders_location_id ON customer_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_brand_id ON customer_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_details_order_id ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_order_details_product_id ON order_details(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_summaries_brand_id ON daily_stock_summaries(brand_id);
CREATE INDEX IF NOT EXISTS idx_daily_stock_summaries_date ON daily_stock_summaries(date);

-- =============================================
-- 7. REALTIME CONFIGURATION
-- =============================================

-- Enable realtime for tables that need live updates (with error handling)
DO $$
BEGIN
    -- Add staff tables to realtime publication if not already added
    -- Check if staff_registrations table exists before adding to realtime
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_registrations') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE staff_registrations;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Check if staff_assignments table exists before adding to realtime
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_assignments') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE staff_assignments;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Check if staff_schedules table exists before adding to realtime
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_schedules') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE staff_schedules;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Add products table to realtime publication if not already added
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE products;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Add customer_orders table to realtime publication if not already added
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_orders') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE customer_orders;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Add order_details table to realtime publication if not already added
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_details') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE order_details;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
    
    -- Add logistics_assignments table to realtime publication if not already added
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logistics_assignments') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE logistics_assignments;
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore error
                NULL;
        END;
    END IF;
END $$;

-- =============================================
-- STAFF REGISTRATION TABLES
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

-- Staff schedules table for weekly staff scheduling
CREATE TABLE IF NOT EXISTS staff_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  staff_registration_id UUID NOT NULL REFERENCES staff_registrations(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(location_id, schedule_date, staff_registration_id)
);

-- =============================================
-- DSIR TABLES
-- =============================================

-- DSIR Reports table
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

-- DSIR Sales Inventory table
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

-- DSIR Ice Cream Inventory table
CREATE TABLE IF NOT EXISTS dsir_ice_cream_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
    flavor VARCHAR(100) NOT NULL,
    beginning INTEGER DEFAULT 0,
    arrival INTEGER DEFAULT 0,
    pull_out INTEGER DEFAULT 0,
    ending INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSIR Materials Inventory table
CREATE TABLE IF NOT EXISTS dsir_materials_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
    material_name VARCHAR(100) NOT NULL,
    beginning INTEGER DEFAULT 0,
    arrival INTEGER DEFAULT 0,
    ending INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSIR Discounts table
CREATE TABLE IF NOT EXISTS dsir_discounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- Text input for name
    id_type VARCHAR(20) NOT NULL CHECK (id_type IN ('senior', 'pwd')), -- Dropdown for ID type
    id_no VARCHAR(50), -- ID number input
    attach_url TEXT, -- Upload image URL
    order_type VARCHAR(20), -- Order type (mychoice, gelatofilipino, mang-sorbetes)
    order_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- Order amount based on type
    discount_amount DECIMAL(10,2) GENERATED ALWAYS AS (order_amount * 0.2) STORED, -- Computed: order * 20%
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSIR Expenses table
CREATE TABLE IF NOT EXISTS dsir_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
    expense_type VARCHAR(100),
    description VARCHAR(100),
    amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSIR Sales Reconciliation table
CREATE TABLE IF NOT EXISTS dsir_sales_recon (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dsir_report_id UUID NOT NULL REFERENCES dsir_reports(id) ON DELETE CASCADE,
    denomination VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 0,
    amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on Staff tables
ALTER TABLE staff_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

-- Enable RLS on DSIR tables
ALTER TABLE dsir_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_sales_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_ice_cream_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_materials_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsir_sales_recon ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Staff tables (drop existing first)
DROP POLICY IF EXISTS "Enable all operations on staff_registrations" ON staff_registrations;
CREATE POLICY "Enable all operations on staff_registrations" ON staff_registrations FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on staff_assignments" ON staff_assignments;
CREATE POLICY "Enable all operations on staff_assignments" ON staff_assignments FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on staff_schedules" ON staff_schedules;
CREATE POLICY "Enable all operations on staff_schedules" ON staff_schedules FOR ALL USING (true);

-- Create RLS policies for DSIR tables (drop existing first)
DROP POLICY IF EXISTS "Enable all operations on dsir_reports" ON dsir_reports;
CREATE POLICY "Enable all operations on dsir_reports" ON dsir_reports FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_sales_inventory" ON dsir_sales_inventory;
CREATE POLICY "Enable all operations on dsir_sales_inventory" ON dsir_sales_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_ice_cream_inventory" ON dsir_ice_cream_inventory;
CREATE POLICY "Enable all operations on dsir_ice_cream_inventory" ON dsir_ice_cream_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_materials_inventory" ON dsir_materials_inventory;
CREATE POLICY "Enable all operations on dsir_materials_inventory" ON dsir_materials_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_discounts" ON dsir_discounts;
CREATE POLICY "Enable all operations on dsir_discounts" ON dsir_discounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_expenses" ON dsir_expenses;
CREATE POLICY "Enable all operations on dsir_expenses" ON dsir_expenses FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all operations on dsir_sales_recon" ON dsir_sales_recon;
CREATE POLICY "Enable all operations on dsir_sales_recon" ON dsir_sales_recon FOR ALL USING (true);

-- Create triggers for Staff tables (drop existing first)
DO $$
BEGIN
    -- Only create trigger if the function exists and table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_registrations') 
       AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_staff_registrations_updated_at ON staff_registrations;
        CREATE TRIGGER update_staff_registrations_updated_at
            BEFORE UPDATE ON staff_registrations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Create trigger for staff_schedules updated_at
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_schedules') 
       AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_staff_schedules_updated_at ON staff_schedules;
        CREATE TRIGGER update_staff_schedules_updated_at
            BEFORE UPDATE ON staff_schedules
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create triggers for DSIR tables (drop existing first)
DROP TRIGGER IF EXISTS update_dsir_reports_updated_at ON dsir_reports;
CREATE TRIGGER update_dsir_reports_updated_at
    BEFORE UPDATE ON dsir_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_sales_inventory_updated_at ON dsir_sales_inventory;
CREATE TRIGGER update_dsir_sales_inventory_updated_at
    BEFORE UPDATE ON dsir_sales_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_ice_cream_inventory_updated_at ON dsir_ice_cream_inventory;
CREATE TRIGGER update_dsir_ice_cream_inventory_updated_at
    BEFORE UPDATE ON dsir_ice_cream_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_materials_inventory_updated_at ON dsir_materials_inventory;
CREATE TRIGGER update_dsir_materials_inventory_updated_at
    BEFORE UPDATE ON dsir_materials_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_discounts_updated_at ON dsir_discounts;
CREATE TRIGGER update_dsir_discounts_updated_at
    BEFORE UPDATE ON dsir_discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_expenses_updated_at ON dsir_expenses;
CREATE TRIGGER update_dsir_expenses_updated_at
    BEFORE UPDATE ON dsir_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dsir_sales_recon_updated_at ON dsir_sales_recon;
CREATE TRIGGER update_dsir_sales_recon_updated_at
    BEFORE UPDATE ON dsir_sales_recon
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for Staff tables
CREATE INDEX IF NOT EXISTS idx_staff_registrations_staff_code ON staff_registrations(staff_code);
CREATE INDEX IF NOT EXISTS idx_staff_registrations_mobile_number ON staff_registrations(mobile_number);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_staff_registration_id ON staff_assignments(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_location_id ON staff_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_assignments_assigned_by_location_id ON staff_assignments(assigned_by_location_id);

-- Create indexes for staff_schedules table
CREATE INDEX IF NOT EXISTS idx_staff_schedules_location_id ON staff_schedules(location_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_registration_id ON staff_schedules(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_date ON staff_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_location_date ON staff_schedules(location_id, schedule_date);

-- Create indexes for DSIR tables
CREATE INDEX IF NOT EXISTS idx_dsir_reports_location_id ON dsir_reports(location_id);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_date ON dsir_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_dsir_reports_staff_registration_id ON dsir_reports(staff_registration_id);
CREATE INDEX IF NOT EXISTS idx_dsir_sales_inventory_report_id ON dsir_sales_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_ice_cream_inventory_report_id ON dsir_ice_cream_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_materials_inventory_report_id ON dsir_materials_inventory(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_discounts_report_id ON dsir_discounts(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_expenses_report_id ON dsir_expenses(dsir_report_id);
CREATE INDEX IF NOT EXISTS idx_dsir_sales_recon_report_id ON dsir_sales_recon(dsir_report_id);

-- =============================================
-- DSIR PREDEFINED ITEMS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS dsir_predefined_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('sales', 'ice_cream', 'materials', 'denominations')),
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(brand_id, category, name)
);

-- Add price column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'dsir_predefined_items' 
                   AND column_name = 'price') THEN
        ALTER TABLE dsir_predefined_items ADD COLUMN price DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE dsir_predefined_items ENABLE ROW LEVEL SECURITY;

-- Create policies (drop existing first)
DROP POLICY IF EXISTS "Enable read access for all users" ON dsir_predefined_items;
CREATE POLICY "Enable read access for all users" ON dsir_predefined_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON dsir_predefined_items;
CREATE POLICY "Enable insert access for all users" ON dsir_predefined_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON dsir_predefined_items;
CREATE POLICY "Enable update access for all users" ON dsir_predefined_items FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON dsir_predefined_items;
CREATE POLICY "Enable delete access for all users" ON dsir_predefined_items FOR DELETE USING (true);

-- Create trigger for updated_at (drop existing first)
DROP TRIGGER IF EXISTS update_dsir_predefined_items_updated_at ON dsir_predefined_items;
CREATE TRIGGER update_dsir_predefined_items_updated_at
    BEFORE UPDATE ON dsir_predefined_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dsir_predefined_items_brand_category ON dsir_predefined_items(brand_id, category);
CREATE INDEX IF NOT EXISTS idx_dsir_predefined_items_active ON dsir_predefined_items(is_active);

-- Insert sample staff registration for testing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_registrations') THEN
        INSERT INTO staff_registrations (full_name, mobile_number, staff_code) 
        VALUES ('Test Staff', '09123456789', '12345678')
        ON CONFLICT (staff_code) DO NOTHING;
    END IF;
END $$;

-- Insert default predefined items for each brand
INSERT INTO dsir_predefined_items (brand_id, category, name) 
SELECT 
    b.id,
    'sales',
    unnest(ARRAY['BIG CUP', 'SMALL CUP', 'WATER', 'CHOCO-COATED', '500ML', '1 PAN'])
FROM brands b
ON CONFLICT (brand_id, category, name) DO NOTHING;

INSERT INTO dsir_predefined_items (brand_id, category, name) 
SELECT 
    b.id,
    'ice_cream',
    unnest(ARRAY['BUBBLEGUM', 'COOKIE BITS', 'COOKIE MON', 'COFFEE', 'CHOCOLATE', 'DURIAN', 'MANGO', 'MELON', 'MATCHA', 'STRAWBERRY', 'UBE', 'UBE QUEZO', 'UNICORN'])
FROM brands b
ON CONFLICT (brand_id, category, name) DO NOTHING;

INSERT INTO dsir_predefined_items (brand_id, category, name) 
SELECT 
    b.id,
    'materials',
    unnest(ARRAY['DSR FORM', 'SPOONS', 'TISSUE', 'GLOVES', 'TRASHBAG', 'SOAP', 'POPSICLE STICKS'])
FROM brands b
ON CONFLICT (brand_id, category, name) DO NOTHING;

INSERT INTO dsir_predefined_items (brand_id, category, name) 
SELECT 
    b.id,
    'denominations',
    unnest(ARRAY['1,000', '500', '200', '100', '50', '20', 'COINS', 'GCASH'])
FROM brands b
ON CONFLICT (brand_id, category, name) DO NOTHING;

-- =============================================
-- SCHEMA COMPLETE
-- =============================================

-- This schema includes:
-- ✅ 5 Core tables (brands, products, locations, customer_orders, order_details)
-- ✅ 1 View (inventory_summary with computed columns)
-- ✅ 3 Fixed brands (Mychoice, Gelatofilipino, Mang Sorbetes)
-- ✅ Automatic timestamp updates via triggers
-- ✅ Row Level Security enabled with permissive policies
-- ✅ Performance indexes for common queries
-- ✅ All foreign key relationships and constraints
-- ✅ Conflict handling for duplicate data insertion

-- To use this schema:
-- 1. Copy and paste this entire file into Supabase SQL Editor
-- 2. Click "Run" to execute
-- 3. Your complete inventory and order management system is ready!

-- For future modifications, only edit this single file to maintain consistency.
