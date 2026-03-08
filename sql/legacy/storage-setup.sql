-- Supabase Storage Setup
-- Admin panelinden banner dosyaları yüklemek için

-- Banners bucket'ını oluştur
INSERT INTO storage.buckets (id, name, owner, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'banners',
    'banners',
    (SELECT id FROM auth.users LIMIT 1),
    true,
    false,
    NULL,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS Politikaları

-- Herkes okuma yapabilir
CREATE POLICY "Public can read banners"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'banners' );

-- Giriş yapmış kullanıcılar yükleyebilir
CREATE POLICY "Authenticated can upload banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'banners' 
    AND auth.role() = 'authenticated'
  );

-- Giriş yapmış kullanıcılar kendi dosyalarını güncelleyebilir/silebilir
CREATE POLICY "Authenticated can manage own banners"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'banners'
    AND auth.role() = 'authenticated'
  )
  WITH CHECK (
    bucket_id = 'banners'
    AND auth.role() = 'authenticated'
  );
