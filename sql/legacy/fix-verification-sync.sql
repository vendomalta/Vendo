-- ============================================================
-- VERIFICATION STATUS SYNC TRIGGER
-- auth.users deki doğrulama durumlarını public.profiles'a senkronize eder
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_verification()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        email_verified = (NEW.email_confirmed_at IS NOT NULL),
        phone_verified = (NEW.phone_confirmed_at IS NOT NULL),
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_verification();

COMMENT ON FUNCTION public.sync_user_verification() IS 'Auth tablosundaki doğrulama değişikliklerini profillere yansıtır';
