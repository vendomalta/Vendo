# Proje Dosya Şeması

```text
    v4/
    ├── 📄 HTML Sayfaları
    │   ├── index.html (Ana Sayfa)
    │   ├── login.html (Giriş & Kayıt)
    │   ├── profil.html (Kullanıcı Profili)
    │   ├── mesajlar.html (Mesajlaşma & İşlemler)
    │   ├── ilanlarim.html (Kullanıcının Yayındaki İlanları)
    │   ├── ilan-ver.html (İlan Verme - Kategori Seçimi)
    │   ├── ilan-ver-form.html (İlan Verme - Detay Formu)
    │   ├── ilan-detay.html (İlan Detay Görüntüleme)
    │   ├── favorilerim.html (Kaydedilen İlanlar)
    │   ├── hesap-bilgileri.html (Kişisel Bilgiler Düzenleme)
    │   ├── ayarlar.html (Hesap & Bildirim Ayarları)
    │   ├── gorunum.html (Tema & Görünüm Seçenekleri)
    │   ├── guvenlik.html (Şifre & 2FA Ayarları)
    │   ├── gizlilik.html (Kullanım Koşulları & Gizlilik)
    │   ├── reset-password.html (Şifre Yenileme)
    │   ├── seller-profile.html (Satıcı Kamu Profili)
    │   ├── kategoriler.html (Kategori Bazlı Listeleme)
    │   ├── migrate-categories.html (Kategori Taşıma Aracı)
    │   └── migrate-standalone.html (Veritabanı Göç Aracı)
    │
    ├── 📁 admin/ (Admin Panel)
    │   ├── index.html (Yönetim Paneli Ana Sayfa)
    │   ├── login.html (Admin Girişi)
    │   ├── css/ (Admin Spesifik Stiller)
    │   │   ├── admin-components.css
    │   │   ├── admin-modern.css
    │   │   ├── admin-panel.css
    │   │   ├── admin-tree-view.css
    │   │   └── login.css
    │   ├── html/ (Admin Alt Modülleri)
    │   │   ├── banner-settings.html
    │   │   └── review-management.html
    │   └── js/ (Admin Mantığı)
    │       ├── admin-panel.js
    │       ├── common-icons.js
    │       └── login.js
    │
    ├── 📁 assets/ (Medya & Statik Dosyalar)
    │   ├── images/ (İkonlar & Logolar)
    │   └── verde-logo.svg
    │
    ├── 📁 components/ (Global Bileşenler)
    │   └── header.html
    │
    ├── 📁 css/ (Stil Kodları)
    │   ├── Temel Yapı
    │   │   ├── reset.css
    │   │   ├── variables.css
    │   │   ├── style.css
    │   │   ├── layout.css
    │   │   └── responsive.css
    │   ├── Bileşen Modülleri
    │   │   ├── components.css (Kartlar, Modallar, Toast)
    │   │   ├── header.css & footer.css
    │   │   ├── sidebar.css (Filtre Paneli)
    │   │   ├── buttons.css (Modern Butonlar)
    │   │   ├── forms.css (Giriş Alanları)
    │   │   ├── filters.css (Arama Arayüzü)
    │   │   ├── notifications-styles.css
    │   │   ├── phone-input.css
    │   │   ├── profile-buttons.css
    │   │   ├── hero.css
    │   │   ├── breadcrumb.css
    │   │   └── transaction-approval.css
    │   ├── Efektler & Animasyonlar
    │   │   ├── animations.css
    │   │   └── animations-enhanced.css
    │   ├── Listeleme & Görünüm
    │   │   ├── list-view.css
    │   │   ├── listings.css (İlan Kartları)
    │   │   ├── mobile-loading.css
    │   │   └── load-more.css
    │   └── Sayfa Spesifik Stiller (pages/)
    │       ├── ad-detail-new.css
    │       ├── edit-listing.css
    │       ├── favorites.css
    │       ├── login.css
    │       ├── messages.css
    │       ├── my-ads.css
    │       ├── profile.css
    │       ├── qa-section.css
    │       └── settings.css
    │
    ├── 📁 js/ (Yazılım Mantığı)
    │   ├── Çekirdek & Güvenlik
    │   │   ├── supabase.js (DB Bağlantısı)
    │   │   ├── auth.js (Oturum Yönetimi)
    │   │   ├── api.js (Merkezi İstekler)
    │   │   ├── csrf-protection.js
    │   │   ├── security-logging.js
    │   │   ├── two-factor-auth.js
    │   │   ├── password-reset.js
    │   │   └── xss-protection.js
    │   ├── İlan & Kategori Fonksiyonları
    │   │   ├── listings-loader.js (Ana Liste)
    │   │   ├── my-listings-loader.js
    │   │   ├── listing-detail-loader.js
    │   │   ├── category-router.js
    │   │   ├── category-data.js
    │   │   ├── ilan-ver-form.js
    │   │   ├── photo-upload.js
    │   │   └── live-preview.js
    │   ├── UI & Deneyim (UX)
    │   │   ├── ui.js & layout.js
    │   │   ├── sidebar-manager.js
    │   │   ├── map-handler.js (Vektör Harita)
    │   │   ├── mobile-enhancements.js
    │   │   ├── viewport-optimizer.js
    │   │   └── malta-localities.json (Lokasyon Verisi)
    │   └── İletişim & Sosyal
    │       ├── messages.js (Realtime Sohbet)
    │       ├── transaction-approval.js (Güvenli İşlem)
    │       ├── qa-system.js (Soru-Cevap)
    │       ├── rating-form.js (Değerlendirme)
    │       ├── seller-profile.js
    │       └── realtime-notifications.js
    │
    ├── 📁 sql/ (Veritabanı Katmanı)
    │   ├── 01_core_schema.sql (Tablolar)
    │   ├── 02_functions_and_triggers.sql (Otomasyon)
    │   ├── 03_security_and_rls.sql (Güvenlik)
    │   ├── 04_storage_setup.sql (Dosya Saklama)
    │   ├── 05_initial_data.sql (Veri Yükleme)
    │   └── 📁 legacy/ (Arşiv Scriptleri)
    │
    ├── 📁 scripts/ (Bakım & Kurulum Scriptleri)
    │   ├── build_migration_tool.js
    │   ├── build_robust_migration.js
    │   ├── debug_extraction.js
    │   └── migrate_to_supabase.js
    │
    ├── 📁 supabase/ (Bulut Fonksiyonları)
    │   └── functions/send-notifications/index.ts
    │
    ├── 📁 docs/ (Varlıklar & Dokümantasyon)
    │
    └── 📁 markdown/ (Proje Kılavuzları)
        ├── README.md
        ├── PROJECT_SCHEMA.md
        └── CODE_SCHEMA.md
```

## 📊 Proje Mimarisi Özeti

### Katmanlar

- **Frontend**: HTML, CSS, JavaScript (130+ dosya)
- **Admin Panel**: `/admin` klasörü (Tamamen yönetilebilir)
- **Stil Sistemi**: Modüler CSS (Değişkenler, Bileşenler, Modüller)
- **API Integration**: Supabase (PostgreSQL, Realtime, Storage, Functions)
- **Bileşenler**: Yeniden kullanılabilir HTML/CSS/JS (Header, Toast, Listeler)

### Ana Özellikler

✅ İlan Yönetimi & Zengin Metin (Rich Text) Desteği
✅ Admin Panel ile Gelişmiş Kullanıcı Yönetimi & Kategori Editörü
✅ Mesajlaşma Sistemi (Realtime + Alım/Satım İşlemleriyle Entegre)
✅ İşlem Onay Sistemi (Buyer/Seller Approval Flow)
✅ Gelişmiş Soru-Cevap (QA) Sistemi
✅ Favoriler ve Arama/Filtreleme (Malta Yerleşke Desteği)
✅ Harita Görünümü & Vektör Harita Entegrasyonu
✅ İnceleme ve Derecelendirme Sistemi
✅ 2FA, CSRF Koruması, Güvenli Oturumlar (Loglar, RLS Politikaları)
✅ Rate Limiting ve XSS Koruması
✅ Responsive & Modern Tasarım (Glassmorphic Bileşenler)
✅ Service Worker (PWA) Destekli Altyapı
✅ Site Ayarları & Dinamik Şablon Yönetimi

### Son Güncellemeler (Şubat 2026)

- **Yeni Özellikler:** İşlem onay sistemi (Transaction Approval) ve gelişmiş Soru-Cevap (QA) sistemi devreye alındı.
- **Admin Geliştirmeleri:** Kategori soruları editörü ve kullanıcı silme/uzaklaştırma yetenekleri eklendi.
- **Kod Temizliği:** Tüm inline `onclick` handler'lar kaldırılarak merkezi `addEventListener` yapısına geçildi.
- **Veritabanı & Güvenlik:** SQL şeması modüler hale getirildi (01-05 arası dosyalar). RLS politikaları ve güvenlik logları sıkılaştırıldı.
- **Hata Düzeltmeleri:** Mesaj yükleme sorunları, mobil header görünürlük sorunları ve banner kapatma butonları optimize edildi.
- **PWA & Bildirimler:** Edge Function tabanlı bildirim yapısı ve manifest yapılandırması güncellendi.
