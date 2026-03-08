-- Migration: Add atomic, sequential listing_number to listings
-- Usage: run this once against your production Postgres (Supabase) database.

-- 1) Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS listings_listing_number_seq;

-- 2) Add the column if it doesn't exist
ALTER TABLE IF EXISTS listings
  ADD COLUMN IF NOT EXISTS listing_number bigint;

-- 3) For existing rows without a listing_number, populate using the sequence
-- This will advance the sequence for each existing row populated.
UPDATE listings
SET listing_number = nextval('listings_listing_number_seq')
WHERE listing_number IS NULL;

-- 4) Ensure the sequence's current value is at least the max(listing_number)
SELECT setval('listings_listing_number_seq', GREATEST((SELECT COALESCE(MAX(listing_number), 0) FROM listings), nextval('listings_listing_number_seq')));

-- 5) Set default for future inserts
ALTER TABLE listings
  ALTER COLUMN listing_number SET DEFAULT nextval('listings_listing_number_seq');

-- 6) Add a unique index so listing_number behaves like a public identifier
CREATE UNIQUE INDEX IF NOT EXISTS listings_listing_number_idx ON listings(listing_number);

-- Note: Run this migration with care. On very large tables, the UPDATE can be slow.
-- Alternative safer approach: create sequence, set default, then backfill in batches.