-- ============================================================
-- VENDO - EMAIL VERIFICATION FIX
-- Run this in your Supabase SQL Editor to fix the automatic 
-- verification issue for new users.
-- ============================================================

-- 1. Modify handle_new_user function to force email_verified to FALSE
-- This ensures the mobile app's OTP flow is always triggered.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        first_name,
        last_name,
        avatar_url,
        phone,
        phone_prefix,
        phone_number,
        city,
        phone_verified,
        email_verified,
        consent_marketing
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'phone_prefix',
        NEW.raw_user_meta_data->>'phone_number',
        COALESCE(NEW.raw_user_meta_data->>'city', 'Valletta'),
        FALSE, -- phone_verified initially false
        FALSE, -- email_verified ALWAYS false initially, forcing app OTP
        COALESCE((NEW.raw_user_meta_data->>'consent_marketing')::boolean, FALSE)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure sync triggers only fire on specific column updates
-- This prevents the initial sync from setting email_verified to true
-- if Supabase confirms the email during the creation phase.

DROP TRIGGER IF EXISTS tr_sync_verification ON auth.users;
CREATE TRIGGER tr_sync_verification 
    AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users 
    FOR EACH ROW 
    EXECUTE FUNCTION public.sync_profile_verification();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_verification_status();

-- 3. (Optional) Reset existing unverified users if needed
-- COMMENTED OUT: Use only if you want to force verification for everyone again
-- UPDATE public.profiles SET email_verified = FALSE WHERE is_admin = FALSE;

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
