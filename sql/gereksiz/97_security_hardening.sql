-- ============================================================
-- VENDO SECURITY HARDENING - 97_SECURITY_HARDENING.sql
-- ============================================================
-- Bu dosya, Supabase Security Advisor uyarılarını gidermek için güvenlik sıkılaştırması yapar.
-- This file hardens security and resolves Supabase Security Advisor warnings.

-- 1. EXTENSION HARDENING
-- Move extensions to a dedicated schema to avoid "Extension in Public" warnings.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
        ALTER EXTENSION "citext" SET SCHEMA extensions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        ALTER EXTENSION "pg_trgm" SET SCHEMA extensions;
    END IF;
END $$;

-- 2. FUNCTION HARDENING (SET search_path = public, extensions)
-- "Function Search Path Mutable" uyarısını çözmek için fonksiyonların search_path parametresini sabitler.
-- Fixes "Function Search Path Mutable" by setting the search_path to a fixed value.

DO $$ 
DECLARE 
    func_record RECORD;
    funcs_to_harden TEXT[] := ARRAY[
        'handle_new_message_notification', 'log_security_event', 'update_seller_stats',
        'get_user_permissions', 'sync_profile_verification', 'update_transaction_approval_timestamp',
        'handle_updated_at', 'cleanup_old_security_logs', 'set_listing_published_at',
        'sync_user_verification', 'get_transaction_status', 'handle_price_drop_notification',
        'update_user_statistics_on_rating', 'handle_new_user', 'update_review_timestamp',
        'log_button_action', 'batch_update_listing_status', 'check_admin_level',
        'update_transaction_counts', 'get_listing_qa_stats', 'is_admin',
        'auto_complete_transaction', 'update_listing_question_timestamp', 'has_permission',
        'update_transaction_completed', 'increment_view_count', 'get_user_stats',
        'check_brute_force', 'cleanup_old_sessions', 'update_transaction_timestamp',
        'update_listing_favorite_count', 'update_listing_message_count'
    ];
    alter_stmt TEXT;
BEGIN
    FOR func_record IN 
        SELECT 
            p.oid,
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' 
          AND p.proname = ANY(funcs_to_harden)
    LOOP
        alter_stmt := format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions', func_record.function_name, func_record.args);
        EXECUTE alter_stmt;
    END LOOP;
END $$;

-- 3. ADVICE FOR USER
-- [!] IMPORTANT: Supabase Dashboard üzerinden "Auth" -> "Settings" -> "Security" kısmından 
-- "Leaked Password Protection" özelliğini aktif etmeniz önerilir.
