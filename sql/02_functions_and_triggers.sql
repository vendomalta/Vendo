-- ============================================================
-- VENDO DATABASE SCHEMA - 02_FUNCTIONS_AND_TRIGGERS.sql
-- ============================================================

-- 1. UTILITY FUNCTIONS

-- Handle updated_at automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. BUSINESS LOGIC FUNCTIONS

-- Increment view count
DROP FUNCTION IF EXISTS public.increment_view_count(UUID);
CREATE OR REPLACE FUNCTION public.increment_view_count(listing_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.listings
    SET view_count = view_count + 1
    WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Handle new user signup (auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        phone,
        city,
        phone_verified,
        email_verified
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'city', 'Valletta'),
        (NEW.phone_confirmed_at IS NOT NULL),
        (NEW.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update listing counts (Favorites, Messages)
CREATE OR REPLACE FUNCTION public.update_listing_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.listings SET favorite_count = favorite_count + 1 WHERE id = NEW.listing_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.listings SET favorite_count = favorite_count - 1 WHERE id = OLD.listing_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_listing_message_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.listings 
    SET message_count = message_count + 1 
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log button action
CREATE OR REPLACE FUNCTION public.log_button_action(
    p_button_type TEXT,
    p_listing_id UUID DEFAULT NULL,
    p_old_status listing_status_enum DEFAULT NULL,
    p_new_status listing_status_enum DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.button_actions (
        user_id,
        button_type,
        listing_id,
        old_status,
        new_status
    ) VALUES (
        auth.uid(),
        p_button_type,
        p_listing_id,
        p_old_status,
        p_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch status update
CREATE OR REPLACE FUNCTION public.batch_update_listing_status(
    p_listing_ids UUID[],
    p_new_status listing_status_enum
)
RETURNS TABLE(success_count INT, failed_count INT) AS $$
DECLARE
    v_success_count INT := 0;
    v_failed_count INT := 0;
    v_listing_id UUID;
BEGIN
    FOREACH v_listing_id IN ARRAY p_listing_ids
    LOOP
        BEGIN
            UPDATE public.listings
            SET status = p_new_status
            WHERE id = v_listing_id
                AND user_id = auth.uid();
            IF FOUND THEN v_success_count := v_success_count + 1;
            ELSE v_failed_count := v_failed_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_failed_count := v_failed_count + 1; END;
    END LOOP;
    RETURN QUERY SELECT v_success_count, v_failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security event logger
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
        user_id, event_type, severity, details, ip_address, user_agent, created_at
    ) VALUES (
        auth.uid(), p_event_type, p_severity, p_details, p_ip_address, p_user_agent, NOW()
    ) RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Brute force detector
CREATE OR REPLACE FUNCTION public.check_brute_force(p_email TEXT, p_ip_address VARCHAR(45))
RETURNS TABLE (is_brute_force BOOLEAN, attempt_count INT, locked_until TIMESTAMPTZ) AS $$
DECLARE
    v_attempt_count INT;
    v_locked_until TIMESTAMPTZ;
BEGIN
    SELECT COUNT(*) INTO v_attempt_count
    FROM public.security_logs
    WHERE user_id = (SELECT id FROM auth.users WHERE email = p_email LIMIT 1)
        AND event_type = 'login_failed'
        AND ip_address = p_ip_address
        AND created_at > NOW() - INTERVAL '1 hour';
    
    IF v_attempt_count > 5 THEN
        v_locked_until := NOW() + INTERVAL '15 minutes';
        RETURN QUERY SELECT TRUE, v_attempt_count, v_locked_until;
    ELSE
        RETURN QUERY SELECT FALSE, v_attempt_count, NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup functions
CREATE OR REPLACE FUNCTION public.cleanup_old_security_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.security_logs WHERE created_at < NOW() - INTERVAL '90 days' AND severity != 'critical';
    DELETE FROM public.security_logs WHERE created_at < NOW() - INTERVAL '1 year' AND severity = 'critical';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.user_sessions WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Sync verification status from auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_verification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    phone_verified = (NEW.phone_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get aggregate user statistics
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);
CREATE OR REPLACE FUNCTION public.get_user_stats(listing_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_listings', COUNT(*),
        'active_listings', COUNT(*) FILTER (WHERE status = 'active'),
        'sold_listings', COUNT(*) FILTER (WHERE status = 'sold'),
        'closed_listings', COUNT(*) FILTER (WHERE status = 'closed'),
        'total_views', COALESCE(SUM(view_count), 0),
        'total_favorites', COALESCE(SUM(favorite_count), 0)
    ) INTO result FROM public.listings WHERE user_id = listing_user_id;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-set timestamps on status change
CREATE OR REPLACE FUNCTION public.set_listing_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') AND NEW.published_at IS NULL THEN
        NEW.published_at = NOW();
    END IF;
    IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') AND NEW.sold_at IS NULL THEN
        NEW.sold_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Seller stats update
CREATE OR REPLACE FUNCTION public.update_seller_stats()
RETURNS TRIGGER AS $$
BEGIN
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            ROUND(AVG(rating)::numeric, 2) as average,
            COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
            COUNT(CASE WHEN rating = 3 THEN 1 END) as neutral,
            COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative
        FROM public.seller_ratings
        WHERE seller_id = NEW.seller_id AND is_approved = TRUE
    )
    INSERT INTO public.seller_stats 
        (seller_id, total_ratings, average_rating, positive_count, neutral_count, negative_count, safe_purchase_count)
    SELECT NEW.seller_id, total, average, positive, neutral, negative, positive FROM stats
    ON CONFLICT (seller_id) DO UPDATE SET
        total_ratings = EXCLUDED.total_ratings,
        average_rating = EXCLUDED.average_rating,
        positive_count = EXCLUDED.positive_count,
        neutral_count = EXCLUDED.neutral_count,
        negative_count = EXCLUDED.negative_count,
        safe_purchase_count = EXCLUDED.safe_purchase_count,
        last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Intelligent message notification
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_profile RECORD;
BEGIN
    SELECT last_seen, is_notified_offline, (raw_user_meta_data->'preferences') as prefs
    INTO recipient_profile
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = NEW.receiver_id;

    IF (recipient_profile.prefs->>'messages')::boolean IS NOT FALSE AND
       recipient_profile.last_seen < (NOW() - INTERVAL '5 minutes') AND
       recipient_profile.is_notified_offline = FALSE THEN
       
       INSERT INTO public.notification_queue (recipient_id, notification_type, related_id, content)
       VALUES (NEW.receiver_id, 'new_message', NEW.id::text, jsonb_build_object('sender_id', NEW.sender_id));
       
       UPDATE public.profiles SET is_notified_offline = TRUE WHERE id = NEW.receiver_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction auto-completion
CREATE OR REPLACE FUNCTION public.auto_complete_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.buyer_approved = TRUE AND NEW.seller_approved = TRUE AND NEW.transaction_completed = FALSE THEN
        NEW.transaction_completed = TRUE;
        NEW.transaction_completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Price drop/update notification handler
CREATE OR REPLACE FUNCTION public.handle_price_drop_notification()
RETURNS TRIGGER AS $$
DECLARE
    fav_record RECORD;
    v_title TEXT;
    v_message TEXT;
BEGIN
    -- Only trigger if price changes and listing is active
    IF (OLD.price IS DISTINCT FROM NEW.price) AND NEW.status = 'active' THEN
        
        -- Determine message based on price direction
        IF NEW.price < OLD.price THEN
            v_title := 'Fiyat Düştü! 📉';
            v_message := '"' || COALESCE(NEW.title, 'İlan') || '" ilanının fiyatı ' || 
                        COALESCE(OLD.price, 0)::text || ' ' || COALESCE(NEW.currency, 'EUR') || ' -> ' || 
                        COALESCE(NEW.price, 0)::text || ' ' || COALESCE(NEW.currency, 'EUR') || ' seviyesine düştü.';
        ELSE
            v_title := 'Fiyat Güncellendi 🏷️';
            v_message := '"' || COALESCE(NEW.title, 'İlan') || '" ilanının fiyatı güncellendi: ' || 
                        COALESCE(NEW.price, 0)::text || ' ' || COALESCE(NEW.currency, 'EUR') || '.';
        END IF;

        -- Notify ALL users who favorited this listing
        FOR fav_record IN (SELECT user_id FROM public.favorites WHERE listing_id = NEW.id) LOOP
            -- 1. App Notification
            INSERT INTO public.notifications (
                user_id,
                type,
                title,
                message,
                related_listing_id,
                action_url
            ) VALUES (
                fav_record.user_id,
                'price_drop', -- Keeping 'price_drop' type for constraint compatibility, or we could add 'price_update'
                v_title,
                v_message,
                NEW.id,
                '/ilan-detay.html?id=' || NEW.id
            );

            -- 2. Email/Push Queue
            INSERT INTO public.notification_queue (
                recipient_id,
                notification_type,
                related_id,
                content
            ) VALUES (
                fav_record.user_id,
                'price_drop',
                NEW.id::text,
                jsonb_build_object(
                    'title', v_title,
                    'message', v_message,
                    'old_price', OLD.price,
                    'new_price', NEW.price,
                    'listing_status', NEW.status
                )
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGERS

-- Fix notification type constraint to allow price_drop
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'new_message',
    'listing_sold',
    'listing_expired',
    'favorite_listing_updated',
    'price_drop',
    'new_review',
    'system_announcement',
    'status_changed'
));

-- Updated At Triggers
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_listings_updated_at ON public.listings;
CREATE TRIGGER tr_listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_transaction_approvals_updated_at ON public.transaction_approvals;
CREATE TRIGGER tr_transaction_approvals_updated_at BEFORE UPDATE ON public.transaction_approvals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_listing_questions_updated_at ON public.listing_questions;
CREATE TRIGGER tr_listing_questions_updated_at BEFORE UPDATE ON public.listing_questions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_listing_answers_updated_at ON public.listing_answers;
CREATE TRIGGER tr_listing_answers_updated_at BEFORE UPDATE ON public.listing_answers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auth Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS tr_sync_verification ON auth.users;
CREATE TRIGGER tr_sync_verification AFTER UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.sync_profile_verification();

-- Listing Stats Triggers
DROP TRIGGER IF EXISTS tr_listing_favorites_count ON public.favorites;
CREATE TRIGGER tr_listing_favorites_count AFTER INSERT OR DELETE ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.update_listing_favorite_count();

DROP TRIGGER IF EXISTS tr_listing_messages_count ON public.messages;
CREATE TRIGGER tr_listing_messages_count AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_listing_message_count();

DROP TRIGGER IF EXISTS tr_seller_ratings_update ON public.seller_ratings;
CREATE TRIGGER tr_seller_ratings_update AFTER INSERT OR UPDATE ON public.seller_ratings FOR EACH ROW EXECUTE FUNCTION public.update_seller_stats();

-- Business Logic Triggers
DROP TRIGGER IF EXISTS tr_new_message_notification ON public.messages;
CREATE TRIGGER tr_new_message_notification AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_notification();

DROP TRIGGER IF EXISTS tr_transaction_auto_complete ON public.transaction_approvals;
CREATE TRIGGER tr_transaction_auto_complete BEFORE UPDATE ON public.transaction_approvals FOR EACH ROW EXECUTE FUNCTION public.auto_complete_transaction();

DROP TRIGGER IF EXISTS tr_listings_status_change ON public.listings;
CREATE TRIGGER tr_listings_status_change BEFORE UPDATE ON public.listings FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION public.set_listing_published_at();

DROP TRIGGER IF EXISTS tr_price_drop_notification ON public.listings;
CREATE TRIGGER tr_price_drop_notification AFTER UPDATE ON public.listings FOR EACH ROW WHEN (OLD.price IS DISTINCT FROM NEW.price) EXECUTE FUNCTION public.handle_price_drop_notification();
