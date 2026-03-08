-- Session Management - Veritabanı Ayarları
-- Bu SQL komutlarını Supabase SQL Editor'de çalıştırın

-- 1. user_sessions tablosunu oluştur
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL,
    device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. İndeks oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);

-- 3. Row Level Security (RLS) Politikaları
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Kullanıcılar sadece kendi oturumlarını görebilir
CREATE POLICY "Users can view their own sessions"
    ON user_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- 5. Kullanıcılar sadece kendi oturumlarını oluşturabilir
CREATE POLICY "Users can create their own sessions"
    ON user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 6. Kullanıcılar sadece kendi oturumlarını silebilir
CREATE POLICY "Users can delete their own sessions"
    ON user_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- 7. Kullanıcılar sadece kendi oturumlarını güncelleyebilir
CREATE POLICY "Users can update their own sessions"
    ON user_sessions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. Ek: Eski oturumları temizlemek için fonksiyon (30 gün üstü)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 9. Cron job ile otomatik temizlik (Supabase pg_cron extension gerekli)
-- SELECT cron.schedule('cleanup-old-sessions', '0 0 * * *', 'SELECT cleanup_old_sessions();');

-- Kontrol: user_sessions tablosu varlığını kontrol et
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'user_sessions';
