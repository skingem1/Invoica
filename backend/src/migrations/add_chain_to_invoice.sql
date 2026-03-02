-- Migration: Add chain field to Invoice table
-- Sprint 10 (multi-chain architecture)
-- Safe to run multiple times (IF NOT EXISTS)

-- Step 1: Add the chain column with default value
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'base';

-- Step 2: Add check constraint for supported chains
-- First drop any existing constraint to make migration idempotent
ALTER TABLE "Invoice"
  DROP CONSTRAINT IF EXISTS invoice_chain_check;

-- Add the constraint restricting chain to supported values
ALTER TABLE "Invoice"
  ADD CONSTRAINT invoice_chain_check
  CHECK (chain IN ('base', 'polygon', 'solana'));

-- Step 3: Add index for efficient chain-based queries
-- This improves performance when filtering invoices by blockchain
CREATE INDEX IF NOT EXISTS idx_invoice_chain
  ON "Invoice" (chain);

-- Step 4: Ensure all existing rows have a chain value
-- This handles any edge cases where the column might be null
UPDATE "Invoice" SET chain = 'base' WHERE chain IS NULL;

-- Verify the migration was successful
-- Should return: chain column exists with correct constraints
DO $$
BEGIN
  -- Verify column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Invoice' AND column_name = 'chain'
  ) THEN
    RAISE EXCEPTION 'Migration failed: chain column not found';
  END IF;

  -- Verify constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoice_chain_check'
  ) THEN
    RAISE EXCEPTION 'Migration failed: invoice_chain_check constraint not found';
  END IF;

  -- Verify index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_invoice_chain'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_invoice_chain index not found';
  END IF;

  RAISE NOTICE 'Migration completed successfully: chain column added to Invoice table';
END $$;
