-- System Settings Table for Dynamic Templates
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial message notification template
INSERT INTO system_settings (key, value)
VALUES (
    'email_template_message',
    jsonb_build_object(
        'subject', 'serı bak onemlı olabılır la | Verde',
        'content', '<h2 style="color: #10b981;">Merhaba {{full_name}},</h2><p>Eger bu maıl ulastıysa bana wp uzerınden mesaj gonder.</p><div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0; font-weight: bold;">Yeni bir mesajınız var!</p><p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Detayları görmek için hemen giriş yapın.</p></div>'
    )
)
ON CONFLICT (key) DO NOTHING;
