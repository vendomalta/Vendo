-- ============================================================
-- VENDO DATABASE SCHEMA - 04_STORAGE_SETUP.sql
-- ============================================================

-- 1. CREATE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
    ('listing-photos', 'listing-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('profile-photos', 'profile-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('banners', 'banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('site-assets', 'site-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. STORAGE POLICIES (RLS)

-- Public Read Access
DROP POLICY IF EXISTS "Public read" ON storage.objects;
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (TRUE);

-- Authenticated Upload Access
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id IN ('listing-photos', 'profile-photos', 'banners', 'site-assets'));

-- Owner Resource Management
DROP POLICY IF EXISTS "Owner manage" ON storage.objects;
CREATE POLICY "Owner manage" ON storage.objects FOR ALL
TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Special Admin Management for assets
DROP POLICY IF EXISTS "Admin manage assets" ON storage.objects;
CREATE POLICY "Admin manage assets" ON storage.objects FOR ALL
TO authenticated
USING (bucket_id IN ('banners', 'site-assets') AND (SELECT public.is_admin(auth.uid())))
WITH CHECK (bucket_id IN ('banners', 'site-assets') AND (SELECT public.is_admin(auth.uid())));
