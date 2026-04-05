-- ============================================================
-- VENDO DATABASE UPDATE - 17_FIX_MARKETING_DEFAULT.sql
-- ============================================================
-- Sync consent_marketing default value with frontend logic (Defaults to TRUE)

-- 1. Change the default value for new users
ALTER TABLE public.profiles ALTER COLUMN consent_marketing SET DEFAULT TRUE;

-- 2. (Optional) Update existing users who have never changed this setting
-- Notice: This will opt-in existing users to marketing notifications.
-- UPDATE public.profiles SET consent_marketing = TRUE WHERE consent_marketing IS FALSE;
