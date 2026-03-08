-- Initialize Post Ad Button Configuration in site_settings
INSERT INTO site_settings (setting_key, setting_value, is_active) 
VALUES (
    'post_ad_button_config',
    '{
        "image_url": "",
        "overlay_color": "rgba(0, 105, 148, 0.6)",
        "is_active": true
    }'::jsonb,
    true
) 
ON CONFLICT (setting_key) DO NOTHING;
