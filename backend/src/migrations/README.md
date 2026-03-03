This directory contains database migrations for the Invoice table and related schema changes.

## Current Migration

### add_chain_to_invoice.sql

Adds a `chain` column to the Invoice table to support multi-chain architecture (Sprint 10).

**Supported Chains:**
- `base` (default)
- `polygon`
- `solana`

## How to Run

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/YOUR_PROJECT/sql)
2. Copy and paste the contents of `add_chain_to_invoice.sql`
3. Click **Run** to execute

## Rollback

If you need to remove this migration:

ALTER TABLE "Invoice" DROP COLUMN IF EXISTS chain;