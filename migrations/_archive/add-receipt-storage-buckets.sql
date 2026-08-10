-- =============================================
-- STORAGE BUCKETS FOR RECEIPT ATTACHMENTS
-- =============================================

-- Create delivery_receipts bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery_receipts', 'delivery_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Create payment_receipts bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment_receipts', 'payment_receipts', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STORAGE POLICIES FOR DELIVERY RECEIPTS
-- =============================================

-- Allow public uploads to delivery_receipts bucket
DROP POLICY IF EXISTS "Allow public uploads to delivery_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public uploads to delivery_receipts bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'delivery_receipts');

-- Allow public reads from delivery_receipts bucket
DROP POLICY IF EXISTS "Allow public reads from delivery_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public reads from delivery_receipts bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'delivery_receipts');

-- Allow public updates to delivery_receipts bucket
DROP POLICY IF EXISTS "Allow public updates to delivery_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public updates to delivery_receipts bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'delivery_receipts');

-- Allow public deletes from delivery_receipts bucket
DROP POLICY IF EXISTS "Allow public deletes from delivery_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public deletes from delivery_receipts bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'delivery_receipts');

-- =============================================
-- STORAGE POLICIES FOR PAYMENT RECEIPTS
-- =============================================

-- Allow public uploads to payment_receipts bucket
DROP POLICY IF EXISTS "Allow public uploads to payment_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public uploads to payment_receipts bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment_receipts');

-- Allow public reads from payment_receipts bucket
DROP POLICY IF EXISTS "Allow public reads from payment_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public reads from payment_receipts bucket" ON storage.objects
FOR SELECT USING (bucket_id = 'payment_receipts');

-- Allow public updates to payment_receipts bucket
DROP POLICY IF EXISTS "Allow public updates to payment_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public updates to payment_receipts bucket" ON storage.objects
FOR UPDATE USING (bucket_id = 'payment_receipts');

-- Allow public deletes from payment_receipts bucket
DROP POLICY IF EXISTS "Allow public deletes from payment_receipts bucket" ON storage.objects;
CREATE POLICY "Allow public deletes from payment_receipts bucket" ON storage.objects
FOR DELETE USING (bucket_id = 'payment_receipts');

