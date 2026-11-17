-- UAE/GCC invoicing (Module 10): Tax Registration Numbers for supplier and
-- customer, and a business logo shown on invoices.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS trn text,
  ADD COLUMN IF NOT EXISTS logo_path text;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trn text;
