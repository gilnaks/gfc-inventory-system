-- Freight fee and bill of lading for dashboard order override (shipment logistics).

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS freight_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS bill_of_lading_url TEXT;
