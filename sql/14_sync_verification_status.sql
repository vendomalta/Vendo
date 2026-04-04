-- Sync Email Verification Status from auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.sync_user_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to watch for email confirmation updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_verification_status();
