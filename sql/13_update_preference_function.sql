-- Atomic JSONB Update Function for User Preferences
-- This prevents race conditions when toggling multiple switches quickly.
CREATE OR REPLACE FUNCTION public.update_user_preference(key_name TEXT, key_value BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET preferences = jsonb_set(
        COALESCE(preferences, '{}'::jsonb),
        ARRAY[key_name],
        to_jsonb(key_value)
    )
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
