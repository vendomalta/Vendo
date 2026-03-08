# Vendo Database Setup Guide

Bu klasör, Vendo projesinin veritabanını sıfırdan kurmak veya başka bir ortama taşımak için gerekli olan tüm SQL dosyalarını içerir.

## 🚀 Kurulum Sırası

Yeni bir veritabanı kurulumu yaparken dosyaları aşağıdaki sırayla Supabase SQL Editor üzerinden çalıştırmanız gerekmektedir:

1.  **`01_core_schema.sql`**: Tablolar, Enum'lar ve temel yapıyı kurar.
2.  **`02_functions_and_triggers.sql`**: Otomatik güncellemeler, sayaçlar ve iş mantığı fonksiyonlarını ekler.
3.  **`03_security_and_rls.sql`**: Row Level Security (RLS) politikalarını ve güvenlik kurallarını tanımlar.
4.  **`04_storage_setup.sql`**: Dosya depolama (Storage) alanlarını (buckets) oluşturur ve izinlerini ayarlar.
5.  **`05_initial_data.sql`**: Başlangıç kategorilerini ve temel site ayarlarını yükler.

## 📁 Dosya Yapısı

- **01-05:** Temel kurulum dosyaları.
- **legacy/**: Eski, parçalı veya artık ihtiyaç duyulmayan ancak referans için saklanan orijinal dosyalar.

## ⚠️ Önemli Notlar

- Kurulum yapmadan önce her zaman mevcut veritabanınızın yedeğini alın.
- `02_functions_and_triggers.sql` içindeki `handle_new_user` fonksiyonu, Supabase üzerindeki `auth.users` tablosu ile entegre çalışır.
- `03_security_and_rls.sql` içindeki politikalar, kullanıcının `profiles` tablosundaki `is_admin` değerine göre tam yetki verir.
