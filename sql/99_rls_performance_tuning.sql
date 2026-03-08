-- ============================================================
-- VENDO RLS PERFORMANCE TUNING - 99_RLS_PERFORMANCE_TUNING.sql
-- ============================================================
-- Bu dosya, RLS politikalarını performans için optimize eder ve MÜKKERRER politikaları TAMAMEN temizler.
-- This file optimizes RLS policies for performance and DEEP CLEANS all redundant policies.

-- HELPER FUNCTION: Drop all policies on a table
-- Bu fonksiyon belirtilen tablodaki tüm politikaları siler.
DO $$ 
DECLARE 
    target_tables TEXT[] := ARRAY[
        'profiles', 'listings', 'categories', 'favorites', 'messages', 
        'listing_questions', 'listing_answers', 'seller_ratings', 
        'transaction_approvals', 'notifications', 'notification_queue', 
        'security_logs', 'user_sessions', 'listing_stats', 'button_actions', 
        'admin_logs', 'site_settings', 'system_settings', 'reports', 
        'blocked_users', 'admin_users', 'roles'
    ];
    t TEXT;
    pol RECORD;
BEGIN
    FOREACH t IN ARRAY target_tables LOOP
        -- Check if table exists before trying to drop policies
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- 1. OPTIMIZED POLICIES (Using (SELECT auth.uid()) pattern)
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "profiles_manage_own" ON public.profiles FOR ALL USING ((SELECT auth.uid()) = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- LISTINGS
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_select_active" ON public.listings FOR SELECT USING (status = 'active');
CREATE POLICY "listings_manage_own" ON public.listings FOR ALL USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "listings_admin_all" ON public.listings FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- FAVORITES
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_manage_own" ON public.favorites FOR ALL USING ((SELECT auth.uid()) = user_id);

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_involved" ON public.messages FOR SELECT USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK ((SELECT auth.uid()) = sender_id);
CREATE POLICY "messages_update_involved" ON public.messages FOR UPDATE USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);
CREATE POLICY "messages_delete_involved" ON public.messages FOR DELETE USING ((SELECT auth.uid()) = sender_id OR (SELECT auth.uid()) = receiver_id);

-- Q&A
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_questions_select_all" ON public.listing_questions FOR SELECT USING (TRUE);
CREATE POLICY "listing_questions_manage_own" ON public.listing_questions FOR ALL USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.listing_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_answers_select_all" ON public.listing_answers FOR SELECT USING (TRUE);
CREATE POLICY "listing_answers_manage_own" ON public.listing_answers FOR ALL USING ((SELECT auth.uid()) = user_id);

-- RATINGS
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_ratings_select_approved" ON public.seller_ratings FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "seller_ratings_select_involved" ON public.seller_ratings FOR SELECT USING ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id);
CREATE POLICY "seller_ratings_insert_own" ON public.seller_ratings FOR INSERT WITH CHECK ((SELECT auth.uid()) = buyer_id);
CREATE POLICY "seller_ratings_admin_all" ON public.seller_ratings FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- TRANSACTIONS
ALTER TABLE public.transaction_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transaction_approvals_manage_involved" ON public.transaction_approvals FOR ALL USING ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id);

-- NOTIFICATIONS & QUEUE
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_manage_own" ON public.notifications FOR ALL USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "notifications_insert_system" ON public.notifications FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_queue_select_own" ON public.notification_queue FOR SELECT USING ((SELECT auth.uid()) = recipient_id);
CREATE POLICY "notification_queue_admin_all" ON public.notification_queue FOR ALL USING ((SELECT public.is_admin(auth.uid())));
CREATE POLICY "notification_queue_insert_auth" ON public.notification_queue FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- SECURITY LOGS & SESSIONS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_logs_manage_own" ON public.security_logs FOR ALL USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "security_logs_admin_select" ON public.security_logs FOR SELECT USING ((SELECT public.is_admin(auth.uid())));

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_sessions_manage_own" ON public.user_sessions FOR ALL USING ((SELECT auth.uid()) = user_id);

-- STATS & ACTIONS
ALTER TABLE public.listing_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_stats_select_all" ON public.listing_stats FOR SELECT USING (TRUE);
CREATE POLICY "listing_stats_manage_owner" ON public.listing_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.listings WHERE listings.id = listing_id AND listings.user_id = (SELECT auth.uid())));

ALTER TABLE public.button_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "button_actions_insert_all" ON public.button_actions FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) IS NULL);
CREATE POLICY "button_actions_select_own" ON public.button_actions FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ADMIN LOGS & SETTINGS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_admin_all" ON public.admin_logs FOR ALL USING ((SELECT public.is_admin(auth.uid())));

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings_select_all" ON public.site_settings FOR SELECT USING (TRUE);
CREATE POLICY "site_settings_admin_all" ON public.site_settings FOR ALL USING ((SELECT public.is_admin(auth.uid())));

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_select_all" ON public.system_settings FOR SELECT USING (TRUE);
CREATE POLICY "system_settings_admin_all" ON public.system_settings FOR ALL USING ((SELECT public.is_admin(auth.uid())));

-- REPORTS & BLOCKS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT WITH CHECK ((SELECT auth.uid()) = reporter_id);
CREATE POLICY "reports_admin_all" ON public.reports FOR ALL USING ((SELECT public.is_admin(auth.uid())));

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_users_manage_own" ON public.blocked_users FOR ALL USING ((SELECT auth.uid()) = blocker_id);

-- GHOST TABLES (From Linter logs)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
        ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "admin_users_admin_all" ON public.admin_users FOR ALL USING ((SELECT public.is_admin(auth.uid())));
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "roles_admin_all" ON public.roles FOR ALL USING ((SELECT public.is_admin(auth.uid())));
    END IF;
END $$;
