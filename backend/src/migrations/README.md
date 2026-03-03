This directory contains database migration scripts for the Invoice system, managed through Supabase.

## Overview

| Migration | Description | Sprint |
|-----------|-------------|--------|
| `add_chain_to_invoice.sql` | Adds `chain` column for multi-chain support | Sprint 10 |

---

## Running Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste and execute

### Option 2: Supabase CLI

supabase db push