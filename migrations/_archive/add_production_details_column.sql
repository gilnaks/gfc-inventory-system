-- Migration: Add production_details column to daily_stock_summaries table
-- Run this SQL in your Supabase SQL editor

-- Add production_details column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'daily_stock_summaries' 
        AND column_name = 'production_details'
    ) THEN
        ALTER TABLE daily_stock_summaries 
        ADD COLUMN production_details JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;





