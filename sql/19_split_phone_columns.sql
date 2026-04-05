-- ============================================================
-- VENDO DATABASE UPDATE - 19_SPLIT_PHONE_COLUMNS.sql
-- ============================================================
-- Splitting phone into phone_prefix and phone_number columns

-- 1. Add new columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_prefix TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Optional: We do not migrate existing data for test accounts as per user request.
-- But for future safety, we can initialize them.
-- UPDATE public.profiles SET phone_prefix = '+356', phone_number = '' WHERE phone_prefix IS NULL;

-- 3. (Internal) Keep original phone column for now but it's deprecated.
