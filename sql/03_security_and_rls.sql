-- ============================================================
-- VENDO DATABASE SCHEMA - 03_SECURITY_AND_RLS.sql
-- ============================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own entries in queue" ON public.notification_queue FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "System can manage queue" ON public.notification_queue FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Allow authenticated insert to queue" ON public.notification_queue FOR INSERT WITH CHECK (auth.role() = 'authenticated');
ALTER TABLE public.transaction_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.button_actions ENABLE ROW LEVEL SECURITY;

-- 2. GLOBAL ADMIN POLICY
-- Grant full access to admin users on critical tables
DROP POLICY IF EXISTS "Admin full access" ON public.listings;
CREATE POLICY "Admin full access" ON public.listings FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
CREATE POLICY "Admin full access" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.categories;
CREATE POLICY "Admin full access" ON public.categories FOR ALL USING (public.is_admin(auth.uid()));

-- 3. PUBLIC ACCESS POLICIES
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.listings;
CREATE POLICY "Anyone can view active listings" ON public.listings FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view questions/answers" ON public.listing_questions;
CREATE POLICY "Anyone can view questions/answers" ON public.listing_questions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view questions/answers" ON public.listing_answers;
CREATE POLICY "Anyone can view questions/answers" ON public.listing_answers FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view approved ratings" ON public.seller_ratings;
CREATE POLICY "Anyone can view approved ratings" ON public.seller_ratings FOR SELECT USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Anyone can view seller stats" ON public.seller_stats;
CREATE POLICY "Anyone can view seller stats" ON public.seller_stats FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can view active stats" ON public.listing_stats;
CREATE POLICY "Anyone can view active stats" ON public.listing_stats FOR SELECT USING (TRUE);

-- Profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- Listings
DROP POLICY IF EXISTS "Users can manage own listings" ON public.listings;
CREATE POLICY "Users can manage own listings" ON public.listings FOR ALL USING (auth.uid() = user_id);

-- Favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- Messages
DROP POLICY IF EXISTS "Users can see own messages" ON public.messages;
CREATE POLICY "Users can see own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can edit/mark read messages" ON public.messages;
CREATE POLICY "Users can edit/mark read messages" ON public.messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Q&A
DROP POLICY IF EXISTS "Users can ask questions" ON public.listing_questions;
CREATE POLICY "Users can ask questions" ON public.listing_questions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own questions" ON public.listing_questions;
CREATE POLICY "Users can manage own questions" ON public.listing_questions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can answer/manage own answers" ON public.listing_answers;
CREATE POLICY "Users can answer/manage own answers" ON public.listing_answers FOR ALL USING (auth.uid() = user_id);

-- Ratings
DROP POLICY IF EXISTS "Users can rate sellers" ON public.seller_ratings;
CREATE POLICY "Users can rate sellers" ON public.seller_ratings FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can see own ratings" ON public.seller_ratings;
CREATE POLICY "Users can see own ratings" ON public.seller_ratings FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Transactions
DROP POLICY IF EXISTS "Involved parties can manage transactions" ON public.transaction_approvals;
CREATE POLICY "Involved parties can manage transactions" ON public.transaction_approvals FOR ALL USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Reports & Blocks
DROP POLICY IF EXISTS "Users can report/block" ON public.reports;
CREATE POLICY "Users can report/block" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can manage own blocks" ON public.blocked_users;
CREATE POLICY "Users can manage own blocks" ON public.blocked_users FOR ALL USING (auth.uid() = blocker_id);

-- Security Logs & Sessions
DROP POLICY IF EXISTS "Users can manage own logs" ON public.security_logs;
CREATE POLICY "Users can manage own logs" ON public.security_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all logs" ON public.security_logs;
CREATE POLICY "Admins can view all logs" ON public.security_logs FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage own sessions" ON public.user_sessions;
CREATE POLICY "Users can manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);

-- Notifications & Stats & Buttons
DROP POLICY IF EXISTS "Allow authenticated insert to notifications" ON public.notifications;
CREATE POLICY "Allow authenticated insert to notifications" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can see own notifications" ON public.notifications;
CREATE POLICY "Users can see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own stats" ON public.listing_stats;
CREATE POLICY "Users can manage own stats" ON public.listing_stats FOR ALL USING (EXISTS (SELECT 1 FROM public.listings WHERE listings.id = listing_id AND listings.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can record button actions" ON public.button_actions;
CREATE POLICY "Users can record button actions" ON public.button_actions FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can see own button logs" ON public.button_actions;
CREATE POLICY "Users can see own button logs" ON public.button_actions FOR SELECT USING (auth.uid() = user_id);

-- 5. ADMIN SPECIFIC POLICIES
DROP POLICY IF EXISTS "Admins can manage logs" ON public.admin_logs;
CREATE POLICY "Admins can manage logs" ON public.admin_logs FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL USING (public.is_admin(auth.uid()));
