# 🏠 VERDE - Sınıflandırılmış İlanlar Platformu

## 📌 Proje Nedir?

VERDE, kullanıcıların ilanlar yayınlayabildiği, harita üzerinden ilanlarını sergileyebildiği ve zengin özelliklerle yönetebildiği tam işlevli, modern bir web/PWA uygulamasıdır.

---

## 🎯 Ana Özellikler

### ✅ Kullanıcı Yönetimi & Deneyimi

- **Kayıt & Giriş**: Supabase Auth ile güvenli, şık ve kompakt tasarımlı kimlik doğrulama.
- **Profil Yönetimi**: Kullanıcı bilgileri, 2FA seçenekleri, hesap ve gizlilik ayarları.
- **Güvenlik (Şubat 2026)**: CSRF koruması, Rate Limiting, şifre sıfırlama akışları ve Security Logging altyapısı.

### ✅ İlan Yayınlama & Etkileşim

- **Zengin Metin (Rich Text) Desteği**: İlan eklerken kolay ve estetik formatlama sağlayan metin editörü.
- **Harita & Konum (Yeni Vector Map)**: İlanlarınızı daha spesifik konumlandırmak için gelişmiş JS harita modülleri.
- **Fotoğraf Yükleme**: Sürükle-bırak destekli, 10 önizleme kutusu.
- **Dinamik Fiyatlandırma**: TRY, EUR, USD, GBP desteği.

### ✅ İlan Listeleme ve Görünüm

- **Ana Sayfa (Yenilenmiş)**: Tüm ilanları modern Glassmorphic Toggle butonları ile grid veya liste (table) formunda görüntüleme.
- **Detay Sayfası**: Tam ilan bilgileri, özel galeriler, entegre değerlendirme (QA ve Rating) sistemi.
- **Arama & Filtre**: Kategori bazlı gelişmiş yan menü filtrelemesi (sidebar-filters).
- **Sayfalama**: Hızlı yüklenen, sonsuz akışlı listeler (Load More).

### ✅ Mesajlaşma & İşlemler (Realtime)

- **Chat Sistemi**: Supabase Realtime ile canlı sohbet (mesajların yüklenme süresi optimize edilmiştir).
- **Bildirimler**: İşlem durumları, mesajlaşma paneline entegre işlem onayları (transaction-approval).

### ✅ Admin Panel (Tam Kontrol)

- **Güvenli Erişim**: Sadece admin yetkililerinin girebildiği ayrıştırılmış panel sistemi.
- **Gelişmiş Yönetim (Şubat 2026)**: Kullanıcıları Auth'tan ve veri tabanından tamamen silme (Hard delete), banner yönetimi, inceleme (review) onayları ve sistem sağlığı denetimi.

---

## 🛠️ Teknik Stack

### Frontend

- **HTML5**: Semantik yapı, sayfa düzeyinde bileşen entegrasyonu.
- **CSS3**: Dinamik geçişler (transitions), CSS değişkenleri (variables), Dark Mode desteği.
- **JavaScript (ES6+)**: Event Delegation mimarisi (inline onclick'lerden arındırılmış modern API yaklaşımı). Async/await ve dinamik yükleme.

### Backend & Database (Supabase)

- **Güvenlik Çekirdeği Katmanları**: `01_core`, `02_functions`, `03_security` modüler veritabanı kurulum SQL scriptleri.
- **Database Modülleri**: Users, Profiles, Listings, Messages, Favorites, Sessions.
- **Storage**: Fotoğraflar, avatar yüklemeleri ve RLS korumalı bucket'lar.

---

## 🚀 Hızlı Kurulum

### 1. Supabase Konfigürasyonu

Proje kök dizinindeki veya `js` içindeki `supabase.js` veya `supabase-config-template.js` kopyalanıp yapılandırılmalıdır:

```javascript
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_KEY = "your-anon-key";
```

### 2. Veritabanı (Modüler Kurulum)

`sql/` klasörü içindeki dosyaları rakam sırasına göre (01'den 05'e) Supabase SQL Editörüne aktarıp çalıştırın. `legacy/` eski kurulumlar için arşivlendi, yeni sistem için numaralı dosyalar kritik ve yeterlidir.

### 3. Projeyi Canlandırın

Sadece bir geliştirici sunucusunda kök dizindeki `index.html` üzerinden projenizi başlatın: (Live Server vscode eklentisi vb.)

---

## 📱 Temel Sayfalar

| Sayfa                  | URL                        | Özellik                                           |
| ---------------------- | -------------------------- | ------------------------------------------------- |
| **Kompakt Giriş**      | login.html                 | Ekran dostu kayıt ve giriş işlemleri.             |
| **Gelişmiş Ana Sayfa** | index.html                 | Grid/Tablo geçişi, harita bazlı dinamik arama.    |
| **Profil & Ekstralar** | profil.html / ayarlar.html | Profil, 2FA, dark/light, hesap güvenlik yönetimi. |
| **Zengin İlan Formu**  | ilan-ver-form.html         | Rich text, çoklu görsel ekleme.                   |
| **Admin Yönetimi**     | admin/index.html           | İlan onaylama, kullanıcı ve sistem log yönetimi.  |

---

## 🎨 Tasarım Standartları

- Projedeki tüm ikonlar **Font Awesome** ve SVG kaynaklıdır (`admin/js/common-icons.js`).
- Event tanımlamaları `addEventListener` yardımıyla yapılarak DOM temiz tutulmuştur.
- **Glassmorphism** bileşenler ile premium his kazandırılmıştır (Örn: Toggle Butonları).

---

## 🐛 Olası Sorun Giderme (Şubat 2026 Çözümleri)

- **Mesajlar 'Loading' Durumunda Kalıyorsa:** Sistemdeki `realtime-notifications.js` ve `messages.js` entegrasyonu başarılı çalışmazsa ortaya çıkabilir; sayfa önbelleğini temizleyiniz.
- **Mobile Header/Banner Hataları:** Tüm mobil boyutlarında responsive yapı optimize edilmiştir, reklam banner'ının kapanma durumu `localStorage` ile başarıyla tutulmaktadır.
- **İlan Kayıt 400 Hatası:** `seller_ratings` tabloları yerine `reviews` RLS yapıları çözülmüştür, veritabanınızı `03_security_and_rls.sql` ile senkronize ettiğinizden emin olun.

---

## 📞 Destek ve Versiyon

**Proje Durumu**: Geliştirme sürecindedir. Frontend stabilite odaklı revizyonlar uygulanmıştır.
**Versiyon**: v4.2 (Şubat 2026 Core Güncellemesi)
**Tarih**: Şubat 2026
