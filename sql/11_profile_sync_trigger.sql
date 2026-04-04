-- Profil tablosu güncellendiğinde Auth metadata'yı (oturum bilgilerini) otomatik senkronize eder
-- Kapsanan Alanlar: İsim, Telefon, Doğum Tarihi, Şehir, Bio

CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users 
  SET raw_user_meta_data = 
    CASE 
      WHEN raw_user_meta_data IS NULL THEN 
        jsonb_build_object(
          'full_name', NEW.full_name, 
          'phone', NEW.phone,
          'birth_date', NEW.birth_date,
          'city', NEW.city,
          'bio', NEW.bio
        )
      ELSE 
        raw_user_meta_data || 
        jsonb_build_object(
          'full_name', NEW.full_name, 
          'phone', NEW.phone,
          'birth_date', NEW.birth_date,
          'city', NEW.city,
          'bio', NEW.bio
        )
    END
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tetikleyiciyi oluştur (Daha önce varsa sil ve yenile)
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update();
