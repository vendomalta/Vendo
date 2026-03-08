-- Örnek Kategori Filtre Yapılandırmaları
-- Vasıta kategorisine Yakıt, Vites ve Yıl filtreleri ekle
UPDATE public.categories 
SET extra_fields_config = '{
    "fields": [
        {"name": "yakit", "label": "Yakıt Tipi", "type": "select", "options": ["Benzin", "Dizel", "LPG", "Elektrik", "Hibrit"]},
        {"name": "vites", "label": "Vites", "type": "select", "options": ["Manuel", "Otomatik", "Yarı Otomatik"]},
        {"name": "yil", "label": "Yıl", "type": "number"}
    ]
}'::jsonb
WHERE slug = 'vasita';

-- Emlak kategorisine Oda Sayısı ve Eşyalı seçeneği ekle
UPDATE public.categories 
SET extra_fields_config = '{
    "fields": [
        {"name": "oda_sayisi", "label": "Oda Sayısı", "type": "select", "options": ["1+0", "1+1", "2+1", "3+1", "4+1", "5+2"]},
        {"name": "esyali", "label": "Eşyalı", "type": "select", "options": ["Evet", "Hayır"]}
    ]
}'::jsonb
WHERE slug = 'emlak';
