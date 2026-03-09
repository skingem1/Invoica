-- Invoica Invoice Sequence Fix — Delete test data with corrupted invoiceNumber
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Confirmed: rows with invoiceNumber > 1_000_000_000 are test data, safe to delete

BEGIN;

-- Preview what will be deleted (run this first, verify before committing)
SELECT id, "invoiceNumber", status, "customerEmail", "createdAt"
FROM "Invoice"
WHERE "invoiceNumber" > 1000000000
ORDER BY "invoiceNumber" ASC;

-- Delete corrupted test rows
DELETE FROM "Invoice"
WHERE "invoiceNumber" > 1000000000;

-- Verify: all remaining invoices should have small sequential numbers
SELECT
  COUNT(*) AS remaining_invoices,
  MAX("invoiceNumber") AS highest_invoice_num
FROM "Invoice";

COMMIT;
