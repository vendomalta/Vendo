-- ============================================================
-- VENDO SECURITY PATCHES - 98_SECURITY_PATCHES.sql
-- ============================================================
-- Uygulamak için Supabase SQL Editor'de çalıştırın.
-- Run this SQL in Supabase SQL Editor to apply fixes.

-- 1. FIX SECURITY DEFINER VIEWS
-- Görünümleri SECURITY INVOKER (Postgres varsayılanı) olarak yeniden oluşturuyoruz.
-- Bu sayede görünümler, sorguyu çalıştıran kullanıcının RLS yetkilerine tabi olur.

-- Failed Login Attempts View
DROP VIEW IF EXISTS public.failed_login_attempts;
CREATE VIEW public.failed_login_attempts WITH (security_invoker = true) AS
SELECT 
    user_id, 
    DATE_TRUNC('hour', created_at) AS hour, 
    COUNT(*) AS attempt_count, 
    ARRAY_AGG(DISTINCT ip_address) AS ip_addresses
FROM public.security_logs 
WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, DATE_TRUNC('hour', created_at) 
HAVING COUNT(*) > 5;

-- Suspicious Activities View
DROP VIEW IF EXISTS public.suspicious_activities;
CREATE VIEW public.suspicious_activities WITH (security_invoker = true) AS
SELECT 
    user_id, 
    event_type, 
    COUNT(*) AS occurrence_count, 
    ARRAY_AGG(DISTINCT ip_address) AS ip_addresses, 
    MAX(created_at) AS last_occurred, 
    MIN(created_at) AS first_occurred
FROM public.security_logs 
WHERE severity = 'critical' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, event_type;

-- Button Usage Stats View
DROP VIEW IF EXISTS public.button_usage_stats;
CREATE VIEW public.button_usage_stats WITH (security_invoker = true) AS
SELECT 
    button_type, 
    COUNT(*) AS usage_count, 
    COUNT(DISTINCT user_id) AS unique_users,
    MAX(created_at) AS last_used
FROM public.button_actions
GROUP BY button_type;

-- User Listing Stats View
DROP VIEW IF EXISTS public.user_listing_stats;
CREATE VIEW public.user_listing_stats WITH (security_invoker = true) AS
SELECT 
    p.id AS user_id, 
    p.full_name, 
    p.email,
    COUNT(l.id) AS total_listings,
    COUNT(l.id) FILTER (WHERE l.status = 'active') AS active_listings,
    COUNT(l.id) FILTER (WHERE l.status = 'sold') AS sold_listings,
    MAX(l.created_at) AS last_listing_at
FROM public.profiles p
LEFT JOIN public.listings l ON p.id = l.user_id
GROUP BY p.id, p.full_name, p.email;

-- 2. FIX MISSING RLS ON system_settings
-- system_settings tablosunda RLS'i aktif et ve erişim politikalarını ekle.

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admins: Full Access
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" 
    ON public.system_settings 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.is_admin = TRUE
        )
    );

-- Everyone (Authenticated/Public): Read-only Access (for templates etc.)
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings" 
    ON public.system_settings 
    FOR SELECT 
    USING (TRUE);

-- ============================================================
-- VERIFICATION QUERIES (Optional)
-- ============================================================
-- SELECT * FROM public.failed_login_attempts LIMIT 5;
-- SELECT * FROM public.system_settings;
