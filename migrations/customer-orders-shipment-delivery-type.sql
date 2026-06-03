-- Allow shipment delivery type for remote store orders on /order portal.
-- VARCHAR(10) already fits "shipment"; run if you use a CHECK constraint on delivery_type.

-- Example if a check constraint exists (adjust name after inspecting your DB):
-- ALTER TABLE customer_orders DROP CONSTRAINT IF EXISTS customer_orders_delivery_type_check;
-- ALTER TABLE customer_orders ADD CONSTRAINT customer_orders_delivery_type_check
--   CHECK (delivery_type IN ('delivery', 'pickup', 'none', 'shipment'));
