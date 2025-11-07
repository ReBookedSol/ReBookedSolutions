-- Migration: Add payment_reference column to orders table
-- This column stores the external payment reference ID (e.g., ORDER-timestamp-userid)
-- used for looking up orders after payment completion

-- Add payment_reference column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create unique index for payment_reference
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference) 
WHERE payment_reference IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN orders.payment_reference IS 'External payment reference ID (e.g., ORDER-timestamp-userid) used for payment gateway callbacks and order lookups';
