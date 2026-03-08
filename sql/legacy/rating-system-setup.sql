-- Yorum/Değerlendirme Sistemi için Veritabanı Tabloları

-- Satıcı Derecelendirmeleri Tablosu
CREATE TABLE IF NOT EXISTS seller_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, listing_id, buyer_id) -- Aynı ürün için bir kez rating
);

-- Satıcı İstatistikleri (Önbellekleme için)
CREATE TABLE IF NOT EXISTS seller_stats (
    seller_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_ratings INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    positive_count INTEGER DEFAULT 0, -- 4-5 yıldız
    neutral_count INTEGER DEFAULT 0,  -- 3 yıldız
    negative_count INTEGER DEFAULT 0, -- 1-2 yıldız
    safe_purchase_count INTEGER DEFAULT 0, -- 4-5 yıldızlı sayı
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX idx_seller_ratings_seller ON seller_ratings(seller_id);
CREATE INDEX idx_seller_ratings_listing ON seller_ratings(listing_id);
CREATE INDEX idx_seller_ratings_buyer ON seller_ratings(buyer_id);
CREATE INDEX idx_seller_ratings_approved ON seller_ratings(is_approved);
CREATE INDEX idx_seller_stats_seller ON seller_stats(seller_id);

-- RLS Politikaları
ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_stats ENABLE ROW LEVEL SECURITY;

-- Herkes onaylanmış ratingler okuyabilir
CREATE POLICY "Public can read approved ratings"
    ON seller_ratings FOR SELECT
    USING (is_approved = true);

-- Giriş yapmış kullanıcılar kendi ratinglarını okuyabilir
CREATE POLICY "Users can read own ratings"
    ON seller_ratings FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Sadece admin onaylanmamış ratingleri görebilir
CREATE POLICY "Admin can read unapproved ratings"
    ON seller_ratings FOR SELECT
    USING (is_approved = false AND auth.role() = 'authenticated');

-- Alıcı sadece kendi ratingini ekleyebilir
CREATE POLICY "Buyers can insert rating"
    ON seller_ratings FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- Alıcı sadece kendi ratingini güncelleyebilir
CREATE POLICY "Buyers can update own rating"
    ON seller_ratings FOR UPDATE
    USING (auth.uid() = buyer_id)
    WITH CHECK (auth.uid() = buyer_id);

-- Satıcı istatistikleri herkese açık
CREATE POLICY "Public can read seller stats"
    ON seller_stats FOR SELECT
    USING (true);

-- Trigger: Rating eklendiğinde satıcı istatistiklerini güncelle
CREATE OR REPLACE FUNCTION update_seller_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Onaylanan rating sayılarını güncelle
    WITH rating_stats AS (
        SELECT 
            COUNT(*) as total,
            ROUND(AVG(rating)::numeric, 2) as average,
            COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
            COUNT(CASE WHEN rating = 3 THEN 1 END) as neutral,
            COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative
        FROM seller_ratings
        WHERE seller_id = NEW.seller_id AND is_approved = true
    )
    INSERT INTO seller_stats 
        (seller_id, total_ratings, average_rating, positive_count, neutral_count, negative_count, safe_purchase_count)
    SELECT 
        NEW.seller_id,
        total,
        average,
        positive,
        neutral,
        negative,
        positive
    FROM rating_stats
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

-- Trigger ekle
CREATE TRIGGER trigger_update_seller_stats
AFTER INSERT OR UPDATE ON seller_ratings
FOR EACH ROW
EXECUTE FUNCTION update_seller_stats();

-- COMMENTS
COMMENT ON TABLE seller_ratings IS 'Satıcı değerlendirmeleri ve yorumları';
COMMENT ON TABLE seller_stats IS 'Satıcı istatistikleri (ortalama rating, yorum sayısı vb)';
COMMENT ON COLUMN seller_ratings.rating IS '1-5 arası yıldız değeri';
COMMENT ON COLUMN seller_ratings.is_approved IS 'Admin onayı (spam filtresi için)';
COMMENT ON COLUMN seller_stats.safe_purchase_count IS '4-5 yıldız alan güvenli alışveriş sayısı';
