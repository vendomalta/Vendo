-- Supabase Storage Setup for Post Ad Button
-- Bu SQL komutu 'site-assets' adında bir bucket oluşturur ve gerekli izinleri ayarlar.

-- 1. 'site-assets' bucket'ını oluştur (Eğer yoksa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Politikalarını Temizle (Eskileri varsa çakışmasın)
DROP POLICY IF EXISTS "Public can read site assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload site assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete site assets" ON storage.objects;

-- 3. Herkes okuma yapabilsin (Public Access)
CREATE POLICY "Public can read site assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'site-assets' );

-- 4. Giriş yapmış kullanıcılar (Admin) yükleme yapabilsin
CREATE POLICY "Authenticated users can upload site assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'site-assets' );

-- 5. Giriş yapmış kullanıcılar (Admin) dosyaları yönetebilsin (Update/Delete)
CREATE POLICY "Authenticated users can delete site assets"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'site-assets' )
WITH CHECK ( bucket_id = 'site-assets' );
