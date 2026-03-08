-- ============================================================
-- VERDE SECURITY LOGGING SISTEMI - DATABASE SETUP
-- ============================================================
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- Run this SQL in Supabase SQL Editor

-- ============================================================
-- 1. SECURITY LOGS TABLOSU
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User Reference
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Event Information
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    details JSONB DEFAULT '{}',
    
    -- Network Information
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON public.security_logs(ip_address);

-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own security logs
CREATE POLICY "Users can view their own security logs"
    ON public.security_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can create their own security logs
CREATE POLICY "Users can create their own security logs"
    ON public.security_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Only admins can view all security logs
CREATE POLICY "Admins can view all security logs"
    ON public.security_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.is_admin = TRUE
        )
    );

-- ============================================================
-- 3. BRUTE FORCE DETECTION VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.failed_login_attempts AS
SELECT
    user_id,
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) AS attempt_count,
    ARRAY_AGG(DISTINCT ip_address) AS ip_addresses
FROM public.security_logs
WHERE event_type = 'login_failed'
    AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, DATE_TRUNC('hour', created_at)
HAVING COUNT(*) > 5;

-- ============================================================
-- 4. SUSPICIOUS ACTIVITY VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.suspicious_activities AS
SELECT
    user_id,
    event_type,
    COUNT(*) AS occurrence_count,
    ARRAY_AGG(DISTINCT ip_address) AS ip_addresses,
    MAX(created_at) AS last_occurred,
    MIN(created_at) AS first_occurred
FROM public.security_logs
WHERE severity = 'critical'
    AND created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, event_type;

-- ============================================================
-- 5. FUNCTION: LOG SECURITY EVENT (Backend helper)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_security_event(
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'info',
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.security_logs (
        user_id,
        event_type,
        severity,
        details,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        auth.uid(),
        p_event_type,
        p_severity,
        p_details,
        p_ip_address,
        p_user_agent,
        NOW()
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. FUNCTION: CHECK BRUTE FORCE (Detect brute force attacks)
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_brute_force(
    p_email TEXT,
    p_ip_address VARCHAR(45)
)
RETURNS TABLE (
    is_brute_force BOOLEAN,
    attempt_count INT,
    locked_until TIMESTAMPTZ
) AS $$
DECLARE
    v_attempt_count INT;
    v_locked_until TIMESTAMPTZ;
BEGIN
    -- Get user_id from email
    WITH user_login AS (
        SELECT id FROM auth.users WHERE email = p_email LIMIT 1
    )
    SELECT COUNT(*) INTO v_attempt_count
    FROM public.security_logs
    WHERE user_id = (SELECT id FROM user_login)
        AND event_type = 'login_failed'
        AND ip_address = p_ip_address
        AND created_at > NOW() - INTERVAL '1 hour';
    
    -- If more than 5 attempts in 1 hour, lock for 15 minutes
    IF v_attempt_count > 5 THEN
        v_locked_until := NOW() + INTERVAL '15 minutes';
        RETURN QUERY SELECT TRUE, v_attempt_count, v_locked_until;
    ELSE
        RETURN QUERY SELECT FALSE, v_attempt_count, NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. FUNCTION: CLEANUP OLD LOGS (Automated maintenance)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
RETURNS void AS $$
BEGIN
    -- Delete logs older than 90 days (except critical events)
    DELETE FROM public.security_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
        AND severity != 'critical';
    
    -- Delete critical events older than 1 year
    DELETE FROM public.security_logs
    WHERE created_at < NOW() - INTERVAL '1 year'
        AND severity = 'critical';
    
    RAISE NOTICE 'Security logs cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. CRON JOB: Automatic cleanup (requires pg_cron extension)
-- ============================================================

-- Uncomment if pg_cron extension is available in your Supabase instance
-- SELECT cron.schedule('cleanup-security-logs', '0 2 * * *', 'SELECT public.cleanup_old_security_logs();');

-- ============================================================
-- 9. VERIFY TABLE CREATION
-- ============================================================

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'security_logs';

-- ============================================================
-- NOTES & USAGE
-- ============================================================

-- Insert test data:
-- INSERT INTO public.security_logs (
--     user_id, event_type, severity, ip_address, user_agent
-- ) VALUES (
--     (SELECT id FROM auth.users LIMIT 1),
--     'login_success',
--     'info',
--     '192.168.1.1',
--     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
-- );

-- View security logs:
-- SELECT * FROM public.security_logs ORDER BY created_at DESC LIMIT 10;

-- View failed login attempts (brute force detection):
-- SELECT * FROM public.failed_login_attempts;

-- View suspicious activities:
-- SELECT * FROM public.suspicious_activities;

-- Check brute force for specific email/IP:
-- SELECT * FROM public.check_brute_force('user@example.com', '192.168.1.1');

-- Cleanup old logs:
-- SELECT public.cleanup_old_security_logs();
