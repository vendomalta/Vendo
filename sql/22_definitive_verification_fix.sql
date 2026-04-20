-- ============================================================
-- VENDO - DEFINITIVE EMAIL VERIFICATION FIX (CLEANUP VERSION)
-- Run this in your Supabase SQL Editor.
-- This script wipes out conflicting triggers and ensures 
-- mandatory verification for the listing flow.
-- ============================================================

-- 1. CLEANUP: Drop ALL potentially conflicting triggers and functions
DROP TRIGGER IF EXISTS tr_sync_verification ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS tr_sync_verification_profiles ON public.profiles;
DROP TRIGGER IF EXISTS tr_sync_profile_verification ON auth.users;
DROP TRIGGER IF EXISTS tr_sync_user_verification ON auth.users;

DROP FUNCTION IF EXISTS public.sync_profile_verification();
DROP FUNCTION IF EXISTS public.sync_user_verification_status();
DROP FUNCTION IF EXISTS public.sync_user_verification();

-- 2. FORCE UNVERIFIED STATUS ON PROFILE CREATION
-- This function guarantees that ANY new profile starts as unverified
CREATE OR REPLACE FUNCTION public.force_new_profile_unverified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email_verified := FALSE;
    NEW.phone_verified := FALSE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_force_new_profile_unverified ON public.profiles;
CREATE TRIGGER tr_force_new_profile_unverified
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.force_new_profile_unverified();

-- 3. UPDATE HANDLE_NEW_USER FUNCTION
-- This is the function called when a new auth.user is created
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
        email_verified,
        phone_verified,
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
        FALSE, -- Force False
        FALSE, -- Force False
        COALESCE((NEW.raw_user_meta_data->>'consent_marketing')::boolean, FALSE)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CLEAN SYNC FUNCTION
-- This will be the ONLY function that syncs verification status
-- It only fires when auth.users is UPDATED (e.g., after OTP verify)
CREATE OR REPLACE FUNCTION public.sync_user_verification_final()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update to TRUE if it was actually confirmed in auth.users
    IF (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL) OR 
       (NEW.email_confirmed_at IS NOT NULL AND (SELECT email_verified FROM public.profiles WHERE id = NEW.id) = FALSE) THEN
        UPDATE public.profiles
        SET email_verified = TRUE,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    IF (NEW.phone_confirmed_at IS NOT NULL AND OLD.phone_confirmed_at IS NULL) THEN
        UPDATE public.profiles
        SET phone_verified = TRUE,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FINAL TRIGGER SETUP
DROP TRIGGER IF EXISTS on_auth_user_updated_final ON auth.users;
CREATE TRIGGER on_auth_user_updated_final
    AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_verification_final();

-- Ensure handle_new_user trigger is also clean
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DEFINITIVE SETUP COMPLETE
-- ============================================================
