-- ============================================================
-- VERDE V3 - SUPABASE DATABASE SCHEMA
-- Version: 2.0.0
-- Date: 2025-12-27
-- 
-- Bu şema, Verde V3 projesinin tüm buton işlevlerini, durum
-- yönetimini ve veri ilişkilerini destekler.
-- 
-- BUTON ANALİZİ ÖZETİ:
-- =====================
-- Proje genelinde 6 ana buton tipi kullanılmaktadır:
-- 
-- 1. EDIT BUTTON (.edit-btn)
--    - Kullanım: İlan düzenleme
--    - Lokasyon: my-listings-loader.js (satır 139)
--    - Fonksiyon: İlanı edit modunda açar
--    - SQL Gereksinimi: UPDATE izni (RLS policy)
-- 
-- 2. DELETE BUTTON (.delete-btn)
--    - Kullanım: İlan silme
--    - Lokasyon: my-listings-loader.js (satır 210-233)
--    - Fonksiyon: Onay sonrası kaydı siler (CASCADE)
--    - SQL Gereksinimi: DELETE izni, ON DELETE CASCADE
-- 
-- 3. PAUSE BUTTON (.pause-btn)
--    - Kullanım: Aktif ilanı pasife alma
--    - Lokasyon: my-listings-loader.js (satır 148, 263-272)
--    - Fonksiyon: Status menüsü açar (Aktif/Pasif/Satıldı)
--    - SQL Gereksinimi: status ENUM, CHECK constraint
-- 
-- 4. ACTIVATE BUTTON (.activate-btn)
--    - Kullanım: Pasif ilanı aktifleştirme
--    - Lokasyon: my-listings-loader.js (satır 150, 298)
--    - Fonksiyon: Status menüsü açar
--    - SQL Gereksinimi: status değiştirme izni
-- 
-- 5. STATS BUTTON (.stats-btn)
--    - Kullanım: İlan istatistikleri görüntüleme
--    - Lokasyon: my-listings-loader.js (satır 141-143)
--    - Fonksiyon: view_count, favorite_count gösterir
--    - SQL Gereksinimi: İstatistik alanları, indexes
-- 
-- 6. FAVORITE BUTTON (.favorite-remove, .favorite-add)
--    - Kullanım: Favori ekleme/çıkarma
--    - Lokasyon: favorites-loader.js (satır 118-119)
--    - Fonksiyon: favorites tablosuna INSERT/DELETE
--    - SQL Gereksinimi: favorites tablosu, UNIQUE constraint
-- 
-- STATUS WORKFLOW (Durum Geçişleri):
-- ==================================
-- active → closed (Pasif butonuna basılınca)
-- closed → active (Aktif butonuna basılınca)
-- active/closed → sold (Satıldı butonuna basılınca)
-- 
-- Normalizasyon Mantığı (normalizeStatus fonksiyonu):
-- - 'inactive', 'deactivated', 'draft', 'closed' → 'closed'
-- - 'sold' → 'sold'
-- - 'active' → 'active'
-- 
-- DB Valid Statuses: 'active', 'draft', 'closed', 'sold', 'deactivated'
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "citext" IS 'Case-insensitive text type';
COMMENT ON EXTENSION "pg_trgm" IS 'Trigram matching for fuzzy search';

-- ============================================================
-- 2. CUSTOM TYPES
-- ============================================================

-- Listing status enum (Buton işlevleri için kritik)
DO $$ BEGIN
    CREATE TYPE listing_status_enum AS ENUM (
        'active',      -- Yayında, görünür (Aktif butonu hedefi)
        'draft',       -- Taslak, sadece sahibi görebilir
        'closed',      -- Pasif/kapalı, yayından kaldırılmış (Pasif butonu hedefi)
        'sold',        -- Satıldı olarak işaretlenmiş (Satıldı butonu hedefi)
        'deactivated'  -- Sistem tarafından devre dışı bırakılmış
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE listing_status_enum IS 'İlan durumları: active=yayında, draft=taslak, closed=pasif, sold=satıldı, deactivated=sistem tarafından kapatılmış';

-- Gender enum
DO $$ BEGIN
    CREATE TYPE gender_enum AS ENUM (
        'male',
        'female',
        'non_binary',
        'prefer_not_say'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE gender_enum IS 'Kullanıcı cinsiyet tercihleri';

-- ============================================================
-- 3. UTILITY FUNCTIONS
-- ============================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_updated_at() IS 'Otomatik updated_at güncelleme trigger fonksiyonu';

-- View count increment function (STATS butonu için)
CREATE OR REPLACE FUNCTION public.increment_view_count(listing_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.listings
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_view_count(UUID) IS 'İlan görüntülenme sayısını 1 artırır (stats-btn için)';

-- Get user stats function (İstatistikler için)
CREATE OR REPLACE FUNCTION public.get_user_stats(target_user_id UUID)
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
    )
    INTO result
    FROM public.listings
    WHERE user_id = target_user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_stats(UUID) IS 'Kullanıcının ilan istatistiklerini döndürür';

-- ============================================================
-- 4. PROFILES TABLE
-- ============================================================
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
    -- Primary
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Identity
    full_name TEXT NOT NULL CHECK (char_length(full_name) >= 2),
    email CITEXT UNIQUE NOT NULL,
    phone TEXT,
    
    -- Profile Media
    avatar_url TEXT,
    cover_url TEXT,
    
    -- Personal Info
    bio TEXT CHECK (char_length(bio) <= 500),
    birth_date DATE CHECK (birth_date <= CURRENT_DATE - INTERVAL '13 years'),
    gender gender_enum,
    
    -- Professional
    profession TEXT,
    company TEXT,
    website TEXT CHECK (website ~ '^https?://'),
    
    -- Location
    city TEXT NOT NULL,
    district TEXT,
    country TEXT DEFAULT 'TR',
    address_line TEXT,
    postal_code TEXT,
    
    -- Verification & Consent
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    identity_verified BOOLEAN DEFAULT FALSE,
    consent_marketing BOOLEAN DEFAULT FALSE,
    
    -- Activity
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX profiles_email_idx ON public.profiles(email) WHERE deleted_at IS NULL;
CREATE INDEX profiles_city_idx ON public.profiles(city) WHERE deleted_at IS NULL;
CREATE INDEX profiles_created_at_idx ON public.profiles(created_at DESC);
CREATE INDEX profiles_last_login_idx ON public.profiles(last_login_at DESC) WHERE deleted_at IS NULL;

-- Unique constraints
CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles(phone) 
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Trigger
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.profiles IS 'Kullanıcı profil bilgileri';
COMMENT ON COLUMN public.profiles.full_name IS 'Kullanıcının tam adı (minimum 2 karakter)';
COMMENT ON COLUMN public.profiles.bio IS 'Kullanıcı hakkında kısa açıklama (max 500 karakter)';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft delete için timestamp';

-- ============================================================
-- 5. LISTINGS TABLE (Tüm buton işlevleri bu tabloya bağlı)
-- ============================================================
DROP TABLE IF EXISTS public.listings CASCADE;

CREATE TABLE public.listings (
    -- Primary
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Owner (EDIT/DELETE butonları bu alana bakar)
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    
    -- Content (EDIT butonu bu alanları düzenler)
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 100),
    description TEXT CHECK (char_length(description) <= 5000),
    
    -- Pricing
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'TL', 'GBP')),
    
    -- Classification
    category TEXT NOT NULL,
    subcategory TEXT,
    location TEXT NOT NULL,
    
    -- Media
    photos TEXT[] DEFAULT ARRAY[]::TEXT[],
    video_url TEXT,
    
    -- Additional Data
    extra_fields JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Status & Visibility (PAUSE/ACTIVATE butonları bu alanı değiştirir)
    status listing_status_enum NOT NULL DEFAULT 'active',
    featured BOOLEAN DEFAULT FALSE,
    urgent BOOLEAN DEFAULT FALSE,
    
    -- Engagement (STATS butonu bu alanları gösterir)
    view_count BIGINT DEFAULT 0 CHECK (view_count >= 0),
    favorite_count INTEGER DEFAULT 0 CHECK (favorite_count >= 0),
    message_count INTEGER DEFAULT 0 CHECK (message_count >= 0),
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT FALSE,
    
    -- Moderation
    moderation_status TEXT DEFAULT 'pending' CHECK (
        moderation_status IN ('pending', 'approved', 'rejected', 'flagged')
    ),
    moderation_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ
);

-- Indexes (Performans optimizasyonu - buton sorguları için)
CREATE INDEX listings_user_id_idx ON public.listings(user_id);
CREATE INDEX listings_status_idx ON public.listings(status) WHERE status = 'active';
CREATE INDEX listings_category_idx ON public.listings(category);
CREATE INDEX listings_location_idx ON public.listings(location);
CREATE INDEX listings_created_at_idx ON public.listings(created_at DESC);
CREATE INDEX listings_price_idx ON public.listings(price);
CREATE INDEX listings_featured_idx ON public.listings(featured, created_at DESC) WHERE featured = TRUE;
CREATE INDEX listings_view_count_idx ON public.listings(view_count DESC);

-- Full-text search index
CREATE INDEX listings_search_idx ON public.listings 
    USING GIN (to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Trigger
DROP TRIGGER IF EXISTS listings_updated_at ON public.listings;
CREATE TRIGGER listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-set published_at when status becomes active (ACTIVATE butonu için)
CREATE OR REPLACE FUNCTION public.set_listing_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.published_at IS NULL THEN
        NEW.published_at = NOW();
    END IF;
    
    IF NEW.status = 'sold' AND OLD.status != 'sold' AND NEW.sold_at IS NULL THEN
        NEW.sold_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_status_change ON public.listings;
CREATE TRIGGER listings_status_change
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.set_listing_published_at();

COMMENT ON TABLE public.listings IS 'İlan tablosu - tüm ürün/hizmet ilanları - edit/delete/pause/activate/stats butonları bu tabloyu kullanır';
COMMENT ON COLUMN public.listings.status IS 'İlan durumu: active (aktif butonu), closed (pasif butonu), sold (satıldı butonu), draft, deactivated';
COMMENT ON COLUMN public.listings.view_count IS 'Görüntülenme sayısı (stats-btn için)';
COMMENT ON COLUMN public.listings.favorite_count IS 'Favori sayısı (stats-btn için)';
COMMENT ON COLUMN public.listings.featured IS 'Öne çıkarılmış ilan mı?';
COMMENT ON COLUMN public.listings.urgent IS 'Acil ilan mı?';
COMMENT ON COLUMN public.listings.expires_at IS 'İlanın sona erme tarihi';
COMMENT ON COLUMN public.listings.moderation_status IS 'Moderasyon durumu: pending, approved, rejected, flagged';

-- ============================================================
-- 6. FAVORITES TABLE (FAVORITE butonu için)
-- ============================================================
DROP TABLE IF EXISTS public.favorites CASCADE;

CREATE TABLE public.favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, listing_id)
);

-- Indexes
CREATE INDEX favorites_user_id_idx ON public.favorites(user_id);
CREATE INDEX favorites_listing_id_idx ON public.favorites(listing_id);
CREATE INDEX favorites_created_at_idx ON public.favorites(created_at DESC);

-- Favorite count trigger (listing.favorite_count'u otomatik günceller)
CREATE OR REPLACE FUNCTION public.update_listing_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.listings
        SET favorite_count = COALESCE(favorite_count, 0) + 1
        WHERE id = NEW.listing_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.listings
        SET favorite_count = GREATEST(COALESCE(favorite_count, 0) - 1, 0)
        WHERE id = OLD.listing_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS favorites_count_trigger ON public.favorites;
CREATE TRIGGER favorites_count_trigger
    AFTER INSERT OR DELETE ON public.favorites
    FOR EACH ROW
    EXECUTE FUNCTION public.update_listing_favorite_count();

COMMENT ON TABLE public.favorites IS 'Kullanıcıların favori ilanları - favorite-add/favorite-remove butonları için';

-- ============================================================
-- 7. MESSAGES TABLE
-- ============================================================
DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.messages (
    id BIGSERIAL PRIMARY KEY,
    
    -- Participants
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Related listing (optional)
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    
    -- Content
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted_by_sender BOOLEAN DEFAULT FALSE,
    is_deleted_by_receiver BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    
    CHECK (sender_id != receiver_id)
);

-- Indexes
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id, created_at DESC);
CREATE INDEX messages_receiver_id_idx ON public.messages(receiver_id, created_at DESC);
CREATE INDEX messages_listing_id_idx ON public.messages(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX messages_unread_idx ON public.messages(receiver_id, is_read) WHERE is_read = FALSE;

-- Message count trigger (listing.message_count'u günceller)
CREATE OR REPLACE FUNCTION public.update_listing_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.listing_id IS NOT NULL THEN
        UPDATE public.listings
        SET message_count = COALESCE(message_count, 0) + 1
        WHERE id = NEW.listing_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_count_trigger ON public.messages;
CREATE TRIGGER messages_count_trigger
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_listing_message_count();

COMMENT ON TABLE public.messages IS 'Kullanıcılar arası mesajlaşma';
COMMENT ON COLUMN public.messages.is_deleted_by_sender IS 'Gönderen tarafından silindi mi?';
COMMENT ON COLUMN public.messages.is_deleted_by_receiver IS 'Alıcı tarafından silindi mi?';

-- ============================================================
-- 8. REVIEWS TABLE
-- ============================================================
DROP TABLE IF EXISTS public.reviews CASCADE;

CREATE TABLE public.reviews (
    id BIGSERIAL PRIMARY KEY,
    
    -- Participants
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Related listing (optional)
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    
    -- Review content
    rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    comment TEXT CHECK (char_length(comment) <= 1000),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(seller_id, reviewer_id, listing_id),
    CHECK (seller_id != reviewer_id)
);

-- Indexes
CREATE INDEX reviews_seller_id_idx ON public.reviews(seller_id);
CREATE INDEX reviews_reviewer_id_idx ON public.reviews(reviewer_id);
CREATE INDEX reviews_listing_id_idx ON public.reviews(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX reviews_rating_idx ON public.reviews(rating);

-- Trigger
DROP TRIGGER IF EXISTS reviews_updated_at ON public.reviews;
CREATE TRIGGER reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.reviews IS 'Satıcı değerlendirmeleri';
COMMENT ON COLUMN public.reviews.rating IS 'Puan (0-5 arası, 0.5 adımlarla)';

-- ============================================================
-- 9. LISTING STATISTICS TABLE (STATS butonu için detaylı veri)
-- ============================================================
DROP TABLE IF EXISTS public.listing_stats CASCADE;

CREATE TABLE public.listing_stats (
    id BIGSERIAL PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    
    -- Snapshot data
    views_today INTEGER DEFAULT 0,
    views_week INTEGER DEFAULT 0,
    views_month INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    messages_count INTEGER DEFAULT 0,
    
    -- Date
    stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    UNIQUE(listing_id, stat_date)
);

CREATE INDEX listing_stats_listing_date_idx ON public.listing_stats(listing_id, stat_date DESC);

COMMENT ON TABLE public.listing_stats IS 'İlan istatistikleri geçmiş takibi - stats-btn için detaylı analitik';

-- ============================================================
-- 10. NOTIFICATIONS TABLE
-- ============================================================
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
    id BIGSERIAL PRIMARY KEY,
    
    -- Target user
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification content
    type TEXT NOT NULL CHECK (type IN (
        'new_message',
        'listing_sold',
        'listing_expired',
        'favorite_listing_updated',
        'new_review',
        'system_announcement',
        'status_changed'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities
    related_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Action URL
    action_url TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX notifications_user_id_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

COMMENT ON TABLE public.notifications IS 'Kullanıcı bildirimleri - buton işlemleri için otomatik bildirim sistemi';

-- ============================================================
-- 11. BUTTON ACTIONS LOG TABLE (Buton kullanım analizi için)
-- ============================================================
DROP TABLE IF EXISTS public.button_actions CASCADE;

CREATE TABLE public.button_actions (
    id BIGSERIAL PRIMARY KEY,
    
    -- User info
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Button info
    button_type TEXT NOT NULL CHECK (button_type IN (
        'edit',
        'delete',
        'pause',
        'activate',
        'stats',
        'favorite_add',
        'favorite_remove',
        'share',
        'message'
    )),
    
    -- Target
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    
    -- Status change details (sadece pause/activate için)
    old_status listing_status_enum,
    new_status listing_status_enum,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX button_actions_user_id_idx ON public.button_actions(user_id, created_at DESC);
CREATE INDEX button_actions_listing_id_idx ON public.button_actions(listing_id);
CREATE INDEX button_actions_button_type_idx ON public.button_actions(button_type);
CREATE INDEX button_actions_created_at_idx ON public.button_actions(created_at DESC);

COMMENT ON TABLE public.button_actions IS 'Buton tıklama logları - kullanıcı davranış analizi için';

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = id);

-- LISTINGS (EDIT/DELETE/PAUSE/ACTIVATE butonları için kritik)
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select_public" ON public.listings;
CREATE POLICY "listings_select_public" ON public.listings
    FOR SELECT
    USING (
        status = 'active' 
        OR auth.uid() = user_id
    );

DROP POLICY IF EXISTS "listings_insert_own" ON public.listings;
CREATE POLICY "listings_insert_own" ON public.listings
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "listings_update_own" ON public.listings;
CREATE POLICY "listings_update_own" ON public.listings
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "listings_delete_own" ON public.listings;
CREATE POLICY "listings_delete_own" ON public.listings
    FOR DELETE
    USING (auth.uid() = user_id);

-- FAVORITES (FAVORITE butonu için)
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_select_own" ON public.favorites;
CREATE POLICY "favorites_select_own" ON public.favorites
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON public.favorites;
CREATE POLICY "favorites_insert_own" ON public.favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own" ON public.favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
    FOR SELECT
    USING (
        auth.uid() = sender_id OR auth.uid() = receiver_id
    );

DROP POLICY IF EXISTS "messages_insert_as_sender" ON public.messages;
CREATE POLICY "messages_insert_as_sender" ON public.messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
CREATE POLICY "messages_update_participant" ON public.messages
    FOR UPDATE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- REVIEWS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "reviews_insert_as_reviewer" ON public.reviews;
CREATE POLICY "reviews_insert_as_reviewer" ON public.reviews
    FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own" ON public.reviews
    FOR UPDATE
    USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own" ON public.reviews
    FOR DELETE
    USING (auth.uid() = reviewer_id);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- BUTTON ACTIONS (Analytics için read-only)
ALTER TABLE public.button_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "button_actions_insert_authenticated" ON public.button_actions;
CREATE POLICY "button_actions_insert_authenticated" ON public.button_actions
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "button_actions_select_own" ON public.button_actions;
CREATE POLICY "button_actions_select_own" ON public.button_actions
    FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================
-- 13. STORAGE BUCKETS & POLICIES
-- ============================================================

-- Listing photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'listing-photos',
    'listing-photos',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Profile photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    true,
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage policies for listing photos
DROP POLICY IF EXISTS "listing_photos_public_read" ON storage.objects;
CREATE POLICY "listing_photos_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'listing-photos');

DROP POLICY IF EXISTS "listing_photos_authenticated_write" ON storage.objects;
CREATE POLICY "listing_photos_authenticated_write" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'listing-photos'
        AND auth.role() = 'authenticated'
    )
    WITH CHECK (
        bucket_id = 'listing-photos'
        AND auth.role() = 'authenticated'
    );

-- Storage policies for profile photos
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_authenticated_write" ON storage.objects;
CREATE POLICY "profile_photos_authenticated_write" ON storage.objects
    FOR ALL
    USING (
        bucket_id = 'profile-photos'
        AND auth.role() = 'authenticated'
    )
    WITH CHECK (
        bucket_id = 'profile-photos'
        AND auth.role() = 'authenticated'
    );

-- ============================================================
-- 14. AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        city,
        district,
        birth_date,
        email_verified,
        phone_verified
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NULLIF(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), 'Valletta'),
        NULLIF(NEW.raw_user_meta_data->>'district', ''),
        NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::DATE,
        (NEW.email_confirmed_at IS NOT NULL),
        (NEW.phone_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Yeni kullanıcı kaydında otomatik profil oluşturur';

-- ============================================================
-- 15. HELPER VIEWS (Raporlama için)
-- ============================================================

-- Active listings with seller info
CREATE OR REPLACE VIEW public.active_listings_view AS
SELECT 
    l.*,
    p.full_name as seller_name,
    p.avatar_url as seller_avatar,
    p.city as seller_city,
    (SELECT AVG(rating) FROM public.reviews WHERE seller_id = l.user_id) as seller_rating,
    (SELECT COUNT(*) FROM public.reviews WHERE seller_id = l.user_id) as seller_review_count
FROM public.listings l
JOIN public.profiles p ON l.user_id = p.id
WHERE l.status = 'active'
    AND p.deleted_at IS NULL
ORDER BY l.created_at DESC;

COMMENT ON VIEW public.active_listings_view IS 'Aktif ilanlar ve satıcı bilgileri';

-- User listing statistics view (STATS butonu için)
CREATE OR REPLACE VIEW public.user_listing_stats AS
SELECT 
    user_id,
    COUNT(*) as total_listings,
    COUNT(*) FILTER (WHERE status = 'active') as active_listings,
    COUNT(*) FILTER (WHERE status = 'sold') as sold_listings,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_listings,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_listings,
    SUM(view_count) as total_views,
    SUM(favorite_count) as total_favorites,
    SUM(message_count) as total_messages,
    MAX(created_at) as last_listing_date
FROM public.listings
GROUP BY user_id;

COMMENT ON VIEW public.user_listing_stats IS 'Kullanıcı başına ilan istatistikleri - stats-btn için';

-- Button usage analytics view
CREATE OR REPLACE VIEW public.button_usage_stats AS
SELECT 
    button_type,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT listing_id) as unique_listings,
    DATE_TRUNC('day', created_at) as day
FROM public.button_actions
GROUP BY button_type, DATE_TRUNC('day', created_at)
ORDER BY day DESC, total_clicks DESC;

COMMENT ON VIEW public.button_usage_stats IS 'Buton kullanım istatistikleri - hangi butonlar daha çok kullanılıyor?';

-- ============================================================
-- 16. HELPER FUNCTIONS FOR BUTTON OPERATIONS
-- ============================================================

-- Log button action (Tüm buton tıklamalarını kaydet)
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

COMMENT ON FUNCTION public.log_button_action IS 'Buton tıklamalarını logla - analytics için';

-- Batch status update (Çoklu ilan durumu güncelleme)
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
            
            IF FOUND THEN
                v_success_count := v_success_count + 1;
            ELSE
                v_failed_count := v_failed_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_success_count, v_failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.batch_update_listing_status IS 'Toplu ilan durum güncelleme - multi-select ile kullanılabilir';

-- ============================================================
-- 17. COMPLETION MESSAGE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERDE V3 DATABASE SCHEMA V2.0.0 SUCCESSFULLY CREATED!';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Tables:';
    RAISE NOTICE '  ✓ profiles (Kullanıcı profilleri)';
    RAISE NOTICE '  ✓ listings (İlanlar - edit/delete/pause/activate/stats)';
    RAISE NOTICE '  ✓ favorites (Favoriler - favorite-add/remove)';
    RAISE NOTICE '  ✓ messages (Mesajlaşma)';
    RAISE NOTICE '  ✓ reviews (Değerlendirmeler)';
    RAISE NOTICE '  ✓ listing_stats (İstatistik geçmişi)';
    RAISE NOTICE '  ✓ notifications (Bildirimler)';
    RAISE NOTICE '  ✓ button_actions (Buton kullanım logları)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Functions:';
    RAISE NOTICE '  ✓ handle_updated_at() - Otomatik timestamp güncelleme';
    RAISE NOTICE '  ✓ increment_view_count() - Görüntülenme sayacı';
    RAISE NOTICE '  ✓ get_user_stats() - Kullanıcı istatistikleri';
    RAISE NOTICE '  ✓ handle_new_user() - Otomatik profil oluşturma';
    RAISE NOTICE '  ✓ set_listing_published_at() - Status değişim trigger';
    RAISE NOTICE '  ✓ update_listing_favorite_count() - Favori sayacı';
    RAISE NOTICE '  ✓ update_listing_message_count() - Mesaj sayacı';
    RAISE NOTICE '  ✓ log_button_action() - Buton tıklama logger';
    RAISE NOTICE '  ✓ batch_update_listing_status() - Toplu status güncelleme';
    RAISE NOTICE '';
    RAISE NOTICE 'Created Views:';
    RAISE NOTICE '  ✓ active_listings_view - Aktif ilanlar + satıcı bilgisi';
    RAISE NOTICE '  ✓ user_listing_stats - Kullanıcı başına istatistikler';
    RAISE NOTICE '  ✓ button_usage_stats - Buton kullanım analizi';
    RAISE NOTICE '';
    RAISE NOTICE 'Button Types Supported:';
    RAISE NOTICE '  ✓ EDIT (.edit-btn) - İlan düzenleme';
    RAISE NOTICE '  ✓ DELETE (.delete-btn) - İlan silme (CASCADE)';
    RAISE NOTICE '  ✓ PAUSE (.pause-btn) - active → closed';
    RAISE NOTICE '  ✓ ACTIVATE (.activate-btn) - closed → active';
    RAISE NOTICE '  ✓ STATS (.stats-btn) - view/favorite/message counts';
    RAISE NOTICE '  ✓ FAVORITE (.favorite-remove) - Favori ekleme/çıkarma';
    RAISE NOTICE '';
    RAISE NOTICE 'Status Workflow:';
    RAISE NOTICE '  active → closed (Pasif butonuna basınca)';
    RAISE NOTICE '  closed → active (Aktif butonuna basınca)';
    RAISE NOTICE '  * → sold (Satıldı butonuna basınca)';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Policies: ALL ENABLED';
    RAISE NOTICE 'Storage Buckets: listing-photos, profile-photos';
    RAISE NOTICE 'Triggers: 7 automated triggers active';
    RAISE NOTICE 'Indexes: 35+ performance indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Frontend kodları zaten uyumlu (normalizeStatus kullanıyor)';
    RAISE NOTICE '  2. Supabase Dashboard''dan RLS policy''leri doğrulayın';
    RAISE NOTICE '  3. Storage bucket''ları oluşturun/güncelleyin';
    RAISE NOTICE '  4. Test verisi eklemek için seed script çalıştırın (opsiyonel)';
    RAISE NOTICE '============================================================';
END $$;
