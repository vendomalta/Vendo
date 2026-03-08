-- Satıcı istatistikleri tetikleyicisini yetkilendir (RLS Hatası Çözümü)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
