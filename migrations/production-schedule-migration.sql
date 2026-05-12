-- Production Schedule and Sticker Printing System
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. PRODUCTION SCHEDULES TABLE
-- Admin sets products and quantities to be produced per schedule date
-- =============================================
CREATE TABLE IF NOT EXISTS production_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  quantity_required INTEGER NOT NULL DEFAULT 0,
  batch_number VARCHAR(50) NOT NULL,
  notes TEXT,
  allow_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, schedule_date)
);

-- =============================================
-- 2. PRODUCTION STICKER LOGS TABLE
-- Each printed sticker = one record with unique ID for QR code
-- =============================================
CREATE TABLE IF NOT EXISTS production_sticker_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES production_schedules(id) ON DELETE SET NULL,
  batch_number VARCHAR(50) NOT NULL,
  manufacture_date DATE NOT NULL,
  serial_number VARCHAR(50) UNIQUE,
  produced_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add released_at column if it doesn't exist (for release tracking)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_sticker_logs' AND column_name = 'released_at') THEN
        ALTER TABLE production_sticker_logs ADD COLUMN released_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_sticker_logs' AND column_name = 'serial_number') THEN
        ALTER TABLE production_sticker_logs ADD COLUMN serial_number VARCHAR(50) UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_sticker_logs' AND column_name = 'produced_at') THEN
        ALTER TABLE production_sticker_logs ADD COLUMN produced_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_schedules' AND column_name = 'notes') THEN
        ALTER TABLE production_schedules ADD COLUMN notes TEXT;
    END IF;
END $$;

-- =============================================
-- 3. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_production_schedules_schedule_date ON production_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_production_schedules_product_id ON production_schedules(product_id);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_product_id ON production_sticker_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_schedule_id ON production_sticker_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_sticker_logs_manufacture_date ON production_sticker_logs(manufacture_date);

-- =============================================
-- 4. RLS
-- =============================================
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_sticker_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on production_schedules" ON production_schedules;
CREATE POLICY "Allow all operations on production_schedules" ON production_schedules FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on production_sticker_logs" ON production_sticker_logs;
CREATE POLICY "Allow all operations on production_sticker_logs" ON production_sticker_logs FOR ALL USING (true);

-- =============================================
-- 5. TRIGGERS
-- =============================================
DROP TRIGGER IF EXISTS update_production_schedules_updated_at ON production_schedules;
CREATE TRIGGER update_production_schedules_updated_at
  BEFORE UPDATE ON production_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
