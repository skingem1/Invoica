# Invoice Sequence Fix

1. Open Supabase Dashboard → SQL Editor → New Query
2. Paste scripts/fix-invoice-sequence.sql
3. Run the SELECT first — confirm the rows shown are test data
4. Then run DELETE + COMMIT
5. After this, new invoices will resume from a sane sequential number
