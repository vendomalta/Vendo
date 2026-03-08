-- ============================================================
-- VERDE ADMIN PANEL ERİŞİM YÖNETİMİ
-- ============================================================
-- Bu dosya admin paneline erişim izni vermek için 3 yöntem sunar:
-- 1. Profiles tablosuna is_admin kolonu ekleme (basit)
-- 2. Ayrı admin_users tablosu (orta seviye)
-- 3. Gelişmiş rol tabanlı erişim sistemi (kapsamlı)
-- ============================================================

-- ============================================================
-- YÖNTEM 1: PROFILES TABLOSUNA is_admin EKLEME (ÖNERİLEN)
-- ============================================================
-- Bu en basit ve hızlı yöntemdir. Mevcut profiles tablosuna 
-- is_admin kolonu ekler.

-- Kolon ekle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Index ekle (hızlı sorgu için)
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles(is_admin) 
WHERE is_admin = TRUE;

-- Yorum ekle
COMMENT ON COLUMN public.profiles.is_admin IS 'Admin paneline erişim izni (TRUE=admin, FALSE=normal kullanıcı)';

-- ============================================================
-- YÖNTEM 2: AYRI ADMIN_USERS TABLOSU
-- ============================================================
-- Daha güvenli bir yöntem. Admin kullanıcıları ayrı bir tabloda
-- tutar ve ek bilgiler saklar.

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Admin Özellikleri
    admin_level TEXT NOT NULL DEFAULT 'moderator' CHECK (
        admin_level IN ('super_admin', 'admin', 'moderator', 'support')
    ),
    permissions JSONB DEFAULT '[]'::jsonb,
    
    -- Aktivasyon
    is_active BOOLEAN DEFAULT TRUE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- İstatistikler
    last_admin_login TIMESTAMPTZ,
    total_actions INTEGER DEFAULT 0,
    
    -- Notlar
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS admin_users_level_idx ON public.admin_users(admin_level);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users(is_active) WHERE is_active = TRUE;

-- Trigger
DROP TRIGGER IF EXISTS admin_users_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.admin_users IS 'Admin paneline erişimi olan kullanıcılar';
COMMENT ON COLUMN public.admin_users.admin_level IS 'Admin yetki seviyesi: super_admin > admin > moderator > support';
COMMENT ON COLUMN public.admin_users.permissions IS 'Özel izinler JSON array formatında';

-- ============================================================
-- YÖNTEM 3: GELİŞMİŞ ROL TABANLI ERİŞİM (RBAC)
-- ============================================================
-- En kapsamlı yöntem. Roller, izinler ve detaylı yetki yönetimi.

-- Roller tablosu
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- İzinler tablosu
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rol-İzin ilişkisi
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kullanıcı-Rol ilişkisi
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, role_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS user_roles_user_idx ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles(role_id);

COMMENT ON TABLE public.roles IS 'Kullanıcı rolleri (admin, moderator, vb)';
COMMENT ON TABLE public.permissions IS 'Sistem izinleri (create_listing, delete_user, vb)';
COMMENT ON TABLE public.role_permissions IS 'Hangi role hangi izinler verildi';
COMMENT ON TABLE public.user_roles IS 'Kullanıcılara atanan roller';

-- ============================================================
-- HAZIR VERI: Temel Roller ve İzinler (YÖNTEM 3 için)
-- ============================================================

-- Temel roller
INSERT INTO public.roles (name, display_name, description, is_admin, priority) VALUES
('super_admin', 'Süper Admin', 'Tüm yetkilere sahip', TRUE, 100),
('admin', 'Admin', 'Genel admin yetkileri', TRUE, 80),
('moderator', 'Moderatör', 'İçerik moderasyonu', TRUE, 60),
('support', 'Destek', 'Kullanıcı desteği', TRUE, 40),
('user', 'Kullanıcı', 'Normal kullanıcı', FALSE, 0)
ON CONFLICT (name) DO NOTHING;

-- Temel izinler
INSERT INTO public.permissions (name, display_name, description, category) VALUES
-- Kullanıcı yönetimi
('users.view', 'Kullanıcıları Görüntüle', 'Kullanıcı listesini görüntüleme', 'users'),
('users.edit', 'Kullanıcıları Düzenle', 'Kullanıcı bilgilerini düzenleme', 'users'),
('users.delete', 'Kullanıcıları Sil', 'Kullanıcı hesaplarını silme', 'users'),
('users.ban', 'Kullanıcıları Yasakla', 'Kullanıcıları yasaklama', 'users'),

-- İlan yönetimi
('listings.view', 'İlanları Görüntüle', 'Tüm ilanları görüntüleme', 'listings'),
('listings.edit', 'İlanları Düzenle', 'Tüm ilanları düzenleme', 'listings'),
('listings.delete', 'İlanları Sil', 'İlanları silme', 'listings'),
('listings.approve', 'İlanları Onayla', 'İlanları onaylama/reddetme', 'listings'),

-- Mesaj yönetimi
('messages.view', 'Mesajları Görüntüle', 'Kullanıcı mesajlarını görüntüleme', 'messages'),
('messages.delete', 'Mesajları Sil', 'Mesajları silme', 'messages'),

-- Kategori yönetimi
('categories.manage', 'Kategorileri Yönet', 'Kategori ekleme/düzenleme/silme', 'categories'),

-- Rapor yönetimi
('reports.view', 'Raporları Görüntüle', 'Kullanıcı raporlarını görüntüleme', 'reports'),
('reports.handle', 'Raporları İşle', 'Raporları inceleme ve aksiyon alma', 'reports'),

-- Ayarlar
('settings.manage', 'Ayarları Yönet', 'Sistem ayarlarını yönetme', 'settings'),

-- İstatistikler
('analytics.view', 'Analitikleri Görüntüle', 'Sistem analitiği ve istatistikleri', 'analytics')
ON CONFLICT (name) DO NOTHING;

-- Süper Admin'e tüm izinleri ver
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin'e çoğu izni ver (settings hariç)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' 
  AND p.name NOT IN ('settings.manage', 'users.delete')
ON CONFLICT DO NOTHING;

-- Moderatör'e sınırlı izinler ver
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'moderator' 
  AND p.name IN (
    'listings.view', 'listings.edit', 'listings.approve',
    'reports.view', 'reports.handle',
    'users.view'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- YARDIMCI FONKSİYONLAR
-- ============================================================

-- YÖNTEM 1 için: Basit admin kontrolü
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin(UUID) IS 'Kullanıcının admin olup olmadığını kontrol eder';

-- YÖNTEM 2 için: Admin seviye kontrolü
CREATE OR REPLACE FUNCTION public.check_admin_level(user_id UUID, required_level TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_level TEXT;
    level_priority INTEGER;
    required_priority INTEGER;
BEGIN
    -- Kullanıcının admin seviyesini al
    SELECT admin_level INTO user_level
    FROM public.admin_users
    WHERE admin_users.user_id = check_admin_level.user_id 
      AND is_active = TRUE;
    
    IF user_level IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Seviye önceliklerini karşılaştır
    SELECT 
        CASE user_level
            WHEN 'super_admin' THEN 100
            WHEN 'admin' THEN 80
            WHEN 'moderator' THEN 60
            WHEN 'support' THEN 40
            ELSE 0
        END INTO level_priority;
    
    SELECT 
        CASE required_level
            WHEN 'super_admin' THEN 100
            WHEN 'admin' THEN 80
            WHEN 'moderator' THEN 60
            WHEN 'support' THEN 40
            ELSE 0
        END INTO required_priority;
    
    RETURN level_priority >= required_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_admin_level(UUID, TEXT) IS 'Kullanıcının belirli admin seviyesine sahip olup olmadığını kontrol eder';

-- YÖNTEM 3 için: İzin kontrolü
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = has_permission.user_id
          AND p.name = permission_name
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.has_permission(UUID, TEXT) IS 'Kullanıcının belirli bir izne sahip olup olmadığını kontrol eder';

-- Kullanıcının tüm izinlerini getir
CREATE OR REPLACE FUNCTION public.get_user_permissions(target_user_id UUID)
RETURNS TABLE(permission_name TEXT, display_name TEXT, category TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.name, p.display_name, p.category
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = target_user_id
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_permissions(UUID) IS 'Kullanıcının tüm izinlerini döndürür';

-- ============================================================
-- KULLANIM ÖRNEKLERİ
-- ============================================================

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- ADMIN KULLANICI EKLEME ÖRNEKLERİ
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- YÖNTEM 1: Mevcut bir kullanıcıyı admin yap
-- Önce kullanıcının email'ini öğren, sonra:
/*
UPDATE public.profiles 
SET is_admin = TRUE 
WHERE email = 'admin@verde.com';
*/

-- YÖNTEM 2: Admin Users tablosuna ekle
/*
INSERT INTO public.admin_users (user_id, admin_level, notes)
SELECT id, 'super_admin', 'Ana sistem yöneticisi'
FROM auth.users
WHERE email = 'admin@verde.com';
*/

-- YÖNTEM 3: Rol ataması yap
/*
INSERT INTO public.user_roles (user_id, role_id)
SELECT au.id, r.id
FROM auth.users au
CROSS JOIN public.roles r
WHERE au.email = 'admin@verde.com' 
  AND r.name = 'super_admin';
*/

-- ============================================================
-- ADMIN LİSTESİNİ GÖRÜNTÜLEME
-- ============================================================

-- YÖNTEM 1: Tüm adminleri listele
/*
SELECT p.id, p.full_name, p.email, p.is_admin, p.created_at
FROM public.profiles p
WHERE p.is_admin = TRUE
ORDER BY p.created_at DESC;
*/

-- YÖNTEM 2: Admin Users tablosundan listele
/*
SELECT 
    au.id,
    p.full_name,
    p.email,
    au.admin_level,
    au.is_active,
    au.granted_at,
    au.last_admin_login
FROM public.admin_users au
JOIN public.profiles p ON au.user_id = p.id
WHERE au.is_active = TRUE
ORDER BY au.admin_level DESC, au.granted_at DESC;
*/

-- YÖNTEM 3: Roller ve izinlerle birlikte
/*
SELECT 
    p.full_name,
    p.email,
    r.display_name as role,
    r.priority,
    COUNT(DISTINCT rp.permission_id) as permission_count
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.id
JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
WHERE r.is_admin = TRUE
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
GROUP BY p.id, p.full_name, p.email, r.display_name, r.priority
ORDER BY r.priority DESC, p.full_name;
*/

-- ============================================================
-- ADMİN YETKİSİNİ KALDIRMA
-- ============================================================

-- YÖNTEM 1: is_admin'i FALSE yap
/*
UPDATE public.profiles 
SET is_admin = FALSE 
WHERE email = 'eski_admin@verde.com';
*/

-- YÖNTEM 2: Admin Users'dan pasif et
/*
UPDATE public.admin_users 
SET is_active = FALSE 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'eski_admin@verde.com');
*/

-- YÖNTEM 3: Rol atamasını sil
/*
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'eski_admin@verde.com')
  AND role_id IN (SELECT id FROM public.roles WHERE is_admin = TRUE);
*/

-- ============================================================
-- GÜVENLİK: RLS POLİCİES (Row Level Security)
-- ============================================================

-- Admin Users tablosu için RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Sadece super_admin'ler admin listesini görebilir
CREATE POLICY "Super admins can view admin users"
ON public.admin_users FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() 
          AND admin_level = 'super_admin'
          AND is_active = TRUE
    )
);

-- Sadece super_admin'ler admin ekleyebilir
CREATE POLICY "Super admins can insert admin users"
ON public.admin_users FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() 
          AND admin_level = 'super_admin'
          AND is_active = TRUE
    )
);

-- Rol tabloları için RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Herkes rolleri ve izinleri okuyabilir (görünürlük için)
CREATE POLICY "Anyone can view roles"
ON public.roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can view permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);

-- Sadece super_admin rol/izin düzenleyebilir
CREATE POLICY "Super admins can manage roles"
ON public.roles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
);

-- ============================================================
-- SONUÇ VE ÖNERİLER
-- ============================================================
/*
HANGİ YÖNTEM SEÇİLMELİ?

🟢 YÖNTEM 1 (is_admin kolonu) - ÖNERİLEN
   + En basit ve hızlı implementasyon
   + Mevcut kodla uyumlu (login.js zaten kullanıyor)
   + Küçük-orta ölçekli projeler için yeterli
   - Detaylı yetki yönetimi yok
   
🟡 YÖNTEM 2 (admin_users tablosu)
   + Daha organize ve güvenli
   + Admin seviyeleri (super_admin, admin, moderator)
   + Admin istatistikleri tutulabilir
   - Biraz daha karmaşık
   
🔴 YÖNTEM 3 (RBAC - Rol Tabanlı)
   + En kapsamlı ve profesyonel
   + Granüler izin kontrolü
   + Büyük projelerde ölçeklenebilir
   - En karmaşık implementasyon
   - Frontend'de izin kontrolü gerektirir

ŞU ANKİ DURUM:
- login.js dosyası YÖNTEM 1'i kullanıyor (is_admin)
- Database'de henüz is_admin kolonu yok
- İLK ADIM: Yukarıdaki SQL'i çalıştır

NASIL KULLANILIR:
1. Bu SQL dosyasını Supabase SQL Editor'de çalıştır
2. İstediğin yöntemi seç (YÖNTEM 1 öneriyorum)
3. Aşağıdaki komutla ilk admin kullanıcını ekle:

   UPDATE public.profiles 
   SET is_admin = TRUE 
   WHERE email = 'your-email@example.com';

4. Admin paneline giriş yap: /admin/login.html
*/
