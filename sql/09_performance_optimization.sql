-- ============================================================
-- VENDO PERFORMANCE OPTIMIZATION - Gelişmiş İndeksleme
-- ============================================================

-- 1. Trigram (Arama) İndeksleri
-- Başlık ve açıklama üzerinde yapılan metinsel aramaları (ilike) hızlandırır.
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON public.listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_listings_description_trgm ON public.listings USING gin (description gin_trgm_ops);

-- 2. JSONB (Dinamik Filtre) İndeksi
-- İlanların "extra_fields" içindeki teknik detaylarına göre filtrelemeyi hızlandırır.
CREATE INDEX IF NOT EXISTS idx_listings_extra_fields_gin ON public.listings USING gin (extra_fields);

-- 3. Fiyat ve Lokasyon İndeksleri
-- Fiyat aralığı ve şehir filtrelerini hızlandırır.
CREATE INDEX IF NOT EXISTS idx_listings_price_currency ON public.listings(price, currency);
CREATE INDEX IF NOT EXISTS idx_listings_location_city ON public.listings(location_city);

-- 4. Kategori ve Tarih Kombinasyonu
-- Kategori sayfalarında en son eklenen ilanları hızlıca getirmek için.
CREATE INDEX IF NOT EXISTS idx_listings_category_created ON public.listings(category_id, created_at DESC);

-- 5. Profil ve İlan İlişkisi Performansı
-- Kullanıcı ilanlarını ve profil detaylarını birleştirirken hızı artırır.
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at) WHERE deleted_at IS NULL;
