-- Profiles tablosundaki city ve country alanlarındaki NOT NULL kısıtlamasını ve varsayılan değerleri kaldırıyoruz.
-- Bu sayede kullanıcı kayıt olurken şehir seçmek zorunda kalmayacak ve veritabanı boş değerleri kabul edecek.

ALTER TABLE public.profiles 
ALTER COLUMN city DROP NOT NULL,
ALTER COLUMN city DROP DEFAULT,
ALTER COLUMN country DROP DEFAULT;

-- Ayrıca handle_new_user fonksiyonunun en güncel halini tekrar tanımlayalım (js tarafında yaptığımız değişiklik ile uyumlu olması için)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        first_name,
        last_name,
        avatar_url,
        phone,
        phone_prefix,
        phone_number,
        city,
        phone_verified,
        email_verified,
        consent_marketing
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'phone',
        NEW.raw_user_meta_data->>'phone_prefix',
        NEW.raw_user_meta_data->>'phone_number',
        NEW.raw_user_meta_data->>'city', -- Artık NULL olabilir
        (NEW.phone_confirmed_at IS NOT NULL),
        (NEW.email_confirmed_at IS NOT NULL),
        COALESCE((NEW.raw_user_meta_data->>'consent_marketing')::boolean, FALSE)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
