-- ============================================================
-- VENDO DATABASE UPDATE - 18_SPLIT_NAME_COLUMNS.sql
-- ============================================================
-- Splitting full_name into first_name and last_name columns

-- 1. Add new columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Populate new columns from existing full_name
-- This splits at the first space. If no space, last_name will be empty.
UPDATE public.profiles 
SET 
    first_name = split_part(full_name, ' ', 1),
    last_name = CASE 
        WHEN position(' ' in full_name) > 0 THEN trim(substring(full_name from position(' ' in full_name)))
        ELSE ''
    END
WHERE (first_name IS NULL OR first_name = '') 
  AND (last_name IS NULL OR last_name = '')
  AND full_name IS NOT NULL;

-- 3. (Optional) Make first_name NOT NULL for future entries if desired
-- ALTER TABLE public.profiles ALTER COLUMN first_name SET NOT NULL;
