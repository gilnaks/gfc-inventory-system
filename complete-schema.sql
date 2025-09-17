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
    -- Add products table to realtime publication if not already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already in publication, ignore error
            NULL;
    END;
    
    -- Add customer_orders table to realtime publication if not already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE customer_orders;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already in publication, ignore error
            NULL;
    END;
    
    -- Add order_details table to realtime publication if not already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_details;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already in publication, ignore error
            NULL;
    END;
    
    -- Add logistics_assignments table to realtime publication if not already added
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE logistics_assignments;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already in publication, ignore error
            NULL;
    END;
END $$;

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
