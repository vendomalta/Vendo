# Proje Kod & Dosya Şeması

Bu belge projenin güncel (Şubat 2026) bileşen ağacını açıklamaktadır. İlgili `PROJECT_SCHEMA.md` dosyası klasör özetini verir, bu dosya spesifik modülleri açıklar.

## 📁 Ana Yapı

Projede toplam **150'den fazla** kaynak dosya yer almaktadır. HTML yapılarına `js` klasöründen `api.js` ve `supabase.js` gibi temel çekirdek dosyalar inject edilmektedir. `css` dosyaları da `style.css`, `layout.css`, ve `variables.css` üzerinden modülerleştirilmiştir.

## ✨ Yeni Geçilen Yapılar

- **JS Event Handlers:** Inline `onclick` kullanımları bırakıldı, yerine `.addEventListener` standartlarına geçildi. (Örn: toggle butonları)
- **Modüler SQL Yapısı:** `sql/legacy` içine alınan eski betiklerin yerine parçalı (01_core, 02_functions, 03_security, vb.) setup kullanıldı.
- **Zengin Metin Editor (Rich Text):** Form açıklamalarında modern arayüz tasarımı öne çıkarıldı (`ilan-ver-form` bileşenlerinde).
- **Kompakt Tasarım:** `login.html`, grid görünümü (`index.html`) modern bileşenlerle (glassmorphism) revize edildi.

## 📄 HTML Sayfaları Dağılımı

- **Kullanıcı Akışı:** `index.html`, `login.html`, `reset-password.html`
- **İlan Akışı:** `ilan-ver.html`, `ilan-ver-form.html`, `ilanlarim.html`, `ilan-detay.html`
- **Kullanıcı Modülleri:** `profil.html`, `mesajlar.html`, `favorilerim.html`, `seller-profile.html`
- **Site Konfigürasyonu:** `ayarlar.html`, `gorunum.html`, `guvenlik.html`, `gizlilik.html`, `hesap-bilgileri.html`
- **Ek İşlemler:** `migrate-categories.html` (geçiş araçları)

## 📁 Stil Sistemi (CSS)

Tüm stiller `/css/` içinde parçalanmış durumdadır;

1. **Temel & Reset:** `variables.css`, `reset.css`, `layout.css`
2. **Kritik Bileşenler:** `header.css`, `footer.css`, `buttons.css`, `forms.css`, `sidebar.css`
3. **Sayfa Bağımlı (Pages):** `pages/login.css`, `pages/edit-listing.css`, `pages/messages.css`, `pages/qa-section.css`

## 📁 Javascript (JS) Dağılımı

Projedeki veriler modüler işlenmektedir;

- **Güvenlik Çekirdeği:** `auth.js`, `csrf-protection.js`, `xss-protection.js`, `rate-limiter.js`
- **İlanlar:** `listings.js`, `listings-loader.js`, `photo-upload.js`
- **Mesajlar & İletişim:** `messages.js`, `realtime-notifications.js`, `message-transaction-ui.js`
- **Arayüz Etkileşim:** `ui.js`, `layout.js`, `map-handler.js`
- **Optimizasyon:** `image-optimizer.js`, `viewport-optimizer.js`, `lazy-loading.js`

## 📁 Admin Panel (`/admin`)

- `index.html` (Dashboard)
- `login.html` (Giriş)
- CSS Dosyaları: `admin-components.css`, `admin-modern.css`, `admin-panel.css`, `admin-tree-view.css`
- Yönetim: Banner ve incelemeler (Review) sayfaları, paneli işlevsel kılmak için eklenmiştir. Tam silme (bulk delete, profil + auth kaldırma) yeteneği mevcuttur.

## 🛠️ SQL Scriptleri (Veritabanı Kurulumu)

Eski scriptler `sql/legacy` altına taşındı. Yeni sıfırdan sistem kurmak için:

1. `01_core_schema.sql` (Temel Tablolar)
2. `02_functions_and_triggers.sql` (Veritabanı Tetikleyicileri)
3. `03_security_and_rls.sql` (Güvenlik ve Politikalar)
4. `04_storage_setup.sql` (Bucket'lar: photos, avatars vs.)
5. `05_initial_data.sql` (Sistem başlama verisi)

---

**Not:** Bu dosya proje geliştirildikçe güncellenmelidir. Her katman kendi içindeki `README.md` (Örn: `/sql/README.md`) dosyasında daha detaylı bilgiye sahiptir.
