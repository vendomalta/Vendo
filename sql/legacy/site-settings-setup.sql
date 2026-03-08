-- Site Ayarları Tablosu (Reklam Banner ve diğer ayarlar için)

CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX idx_site_settings_key ON site_settings(setting_key);
CREATE INDEX idx_site_settings_active ON site_settings(is_active);

-- Örnek veri (İlan detay sayfası banner) - PNG dosya yüklendikten sonra güncellenecek
INSERT INTO site_settings (setting_key, setting_value, is_active) 
VALUES (
    'detail_page_banner',
    '{
        "image_url": "",
        "link_url": "",
        "alt_text": ""
    }'::jsonb,
    false
) ON CONFLICT (setting_key) DO NOTHING;

-- RLS (Row Level Security) Politikaları
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Public can read site settings" 
    ON site_settings FOR SELECT 
    USING (true);

-- Sadece giriş yapmış kullanıcılar yazabilir
CREATE POLICY "Authenticated users can manage site settings" 
    ON site_settings FOR ALL 
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE site_settings IS 'Reklam banner ve genel site ayarları';
COMMENT ON COLUMN site_settings.setting_key IS 'Ayar anahtarı (detail_page_banner, home_page_banner vb)';
COMMENT ON COLUMN site_settings.setting_value IS 'Ayar değeri (JSON formatında)';
COMMENT ON COLUMN site_settings.is_active IS 'Ayarın aktif olup olmadığı';
