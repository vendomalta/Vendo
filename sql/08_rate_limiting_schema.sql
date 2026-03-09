-- ============================================================
-- VENDO SECURITY: SERVER-SIDE RATE LIMITING
-- ============================================================

-- 1. Create a table to track actions
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_user_action ON public.rate_limit_logs(user_id, action_type, created_at);

-- 2. Cleanup Function (removes old logs periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limit_logs WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Rate Limit Enforcer Function
CREATE OR REPLACE FUNCTION public.check_rate_limit()
RETURNS trigger AS $$
DECLARE
    limit_count INT;
    max_allowed INT;
    time_window INTERVAL;
BEGIN
    -- Config based on action type
    IF TG_TABLE_NAME = 'listings' THEN
        max_allowed := 5;
        time_window := interval '10 minutes';
    ELSIF TG_TABLE_NAME = 'messages' THEN
        max_allowed := 10;
        time_window := interval '1 minute';
    ELSIF TG_TABLE_NAME = 'listing_questions' THEN
        max_allowed := 3;
        time_window := interval '5 minutes';
    ELSE
        RETURN NEW;
    END IF;

    -- Count recent actions
    SELECT count(*) INTO limit_count
    FROM public.rate_limit_logs
    WHERE user_id = auth.uid()
      AND action_type = TG_TABLE_NAME
      AND created_at > (now() - time_window);

    IF limit_count >= max_allowed THEN
        RAISE EXCEPTION 'Rate limit exceeded. Please wait before trying again.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Log the current action
    INSERT INTO public.rate_limit_logs (user_id, action_type)
    VALUES (auth.uid(), TG_TABLE_NAME);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Triggers to Tables
DROP TRIGGER IF EXISTS tr_rate_limit_listings ON public.listings;
CREATE TRIGGER tr_rate_limit_listings
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_messages ON public.messages;
CREATE TRIGGER tr_rate_limit_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_questions ON public.listing_questions;
CREATE TRIGGER tr_rate_limit_questions
BEFORE INSERT ON public.listing_questions
FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

-- 5. Enable RLS on rate_limit_logs (Private)
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rate limit logs are private to admin" ON public.rate_limit_logs
FOR ALL USING (public.is_admin(auth.uid()));
