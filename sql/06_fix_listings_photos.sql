-- Tablo sütun ismi düzeltmesi: Frontend'in beklediği 'photos' ismini kullanmak için
-- 'images' sütununu 'photos' olarak yeniden adlandırıriz.

ALTER TABLE public.listings RENAME COLUMN images TO photos;
