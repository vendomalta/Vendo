-- ============================================================
-- VENDO DATABASE SCHEMA - 05_INITIAL_DATA.sql
-- ============================================================

-- 1. DEFAULT CATEGORIES
INSERT INTO public.categories (name, slug, icon, icon_color, level) VALUES
('Vasıta', 'vasita', 'car', '#e74c3c', 0),
('Emlak', 'emlak', 'home', '#3498db', 0),
('İkinci El ve Sıfır Alışveriş', 'ikinci-el-ve-sifir-alisveris', 'shopping-bag', '#2ecc71', 0),
('İş Makineleri & Sanayi', 'is-makineleri-sanayi', 'cogs', '#f1c40f', 0),
('Yedek Parça, Aksesuar, Donanım & Tuning', 'yedek-parca-aksesuar-donanim-tuning', 'wrench', '#9b59b6', 0),
('Hizmetler', 'hizmetler', 'handshake', '#1abc9c', 0),
('İş İlanları', 'is-ilanlari', 'briefcase', '#34495e', 0),
('Hayvanlar Alemi', 'hayvanlar-alemi', 'paw', '#e67e22', 0),
('Ders Verenler', 'ders-verenler', 'graduation-cap', '#95a5a6', 0),
('Yardımcı Arıyanlar', 'yardimci-ariyanlar', 'user-plus', '#d35400', 0)
ON CONFLICT (slug) DO NOTHING;

-- 2. DEFAULT SITE SETTINGS
INSERT INTO public.site_settings (setting_key, setting_value, is_active) VALUES 
('detail_page_banner', '{"image_url": "", "link_url": "", "alt_text": "Reklam Alanı"}', false),
('site_config', '{"name": "Vendo", "tagline": "Türkiye''nin İlan Platformu"}', true),
('post_ad_button_config', '{"image_url": "", "overlay_color": "rgba(0, 105, 148, 0.6)", "is_active": true}', true)
ON CONFLICT (setting_key) DO NOTHING;
