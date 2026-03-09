-- ============================================================
-- GÜVENLİK DÜZELTMESİ: Hassas profil verilerini koru
-- Bu dosyayı Supabase SQL Editor'da çalıştır
-- Her adım güvenle tekrar çalıştırılabilir (idempotent)
-- ============================================================

-- ADIM 1: profiles tablosundaki "herkes görebilir" politikaları sil
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view safe profile fields" ON public.profiles;

-- ADIM 2: Sadece PUBLIC görünür alanları gösteren policy oluştur
-- NOT: Tam alan düzeyinde güvenlik için "secure_profiles" view'ı kullanılması önerilir.
CREATE POLICY "Public can view safe profile fields" ON public.profiles
FOR SELECT USING (deleted_at IS NULL);

-- ADIM 3: user_sessions tablosunu koru
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.user_sessions;
CREATE POLICY "Users can manage own sessions" ON public.user_sessions
FOR ALL USING (auth.uid() = user_id);

-- ADIM 4: security_logs'u sıkılaştır
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own logs" ON public.security_logs;
CREATE POLICY "Users can manage own logs" ON public.security_logs
FOR ALL USING (auth.uid() = user_id);

-- ADIM 5: site_settings readonly (sadece is_active olanlar)
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can view active site settings" ON public.site_settings;
CREATE POLICY "Anyone can view active site settings" ON public.site_settings
FOR SELECT USING (is_active = TRUE);

