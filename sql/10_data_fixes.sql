-- ============================================================
-- DATA FIX: Ensure critical site settings exist
-- Run this in Supabase SQL Editor
-- ============================================================

-- Fix site_settings if missing entries
INSERT INTO public.site_settings (setting_key, setting_value, is_active)
VALUES 
('homepage_banner', '{"image_url": "/assets/images/hero-bg.jpg", "title": "Buy & Sell in Malta", "subtitle": "VENDO is the most modern classifieds platform in Malta.", "is_active": true}', true),
('footer_config', '{"address": "Valletta, Malta", "email": "support@vendo.com.mt", "phone": "+356 0000 0000"}', true),
('social_links', '{"facebook": "#", "instagram": "#", "twitter": "#"}', true)
ON CONFLICT (setting_key) DO UPDATE 
SET is_active = EXCLUDED.is_active,
    setting_value = public.site_settings.setting_value; -- Keep existing value if key exists

-- Ensure post_ad_button_config is active
UPDATE public.site_settings 
SET is_active = true 
WHERE setting_key = 'post_ad_button_config';
