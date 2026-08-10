-- Add returnable_pans_image_url column to customer_orders table
ALTER TABLE customer_orders 
ADD COLUMN returnable_pans_image_url TEXT;

-- Enable RLS on returnable_pans bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('returnable_pans', 'returnable_pans', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to returnable_pans bucket
CREATE POLICY "Allow public uploads to returnable_pans bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'returnable_pans');

-- Allow public reads from returnable_pans bucket
CREATE POLICY "Allow public reads from returnable_pans bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'returnable_pans');

-- Allow public updates to returnable_pans bucket
CREATE POLICY "Allow public updates to returnable_pans bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'returnable_pans');

-- Allow public deletes from returnable_pans bucket
CREATE POLICY "Allow public deletes from returnable_pans bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'returnable_pans');
