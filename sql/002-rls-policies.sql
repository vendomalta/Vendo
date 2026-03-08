-- ============================================================
-- RLS (Row Level Security) Politikaları
-- Tarih: 2026-03-03
-- ============================================================

-- ── listings tablosu ────────────────────────────────────────

-- Önceki yanlış politikayı temizle
DROP POLICY IF EXISTS "owner_only" ON listings;

-- Herkes aktif ilanları okuyabilsin (ana ekran için şart)
CREATE POLICY "public_read_listings" ON listings
  FOR SELECT USING (true);

-- Sadece ilanın sahibi yeni ilan ekleyebilsin
CREATE POLICY "owner_insert_listings" ON listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sadece ilanın sahibi kendi ilanını güncelleyebilsin
CREATE POLICY "owner_update_listings" ON listings
  FOR UPDATE USING (auth.uid() = user_id);

-- Sadece ilanın sahibi kendi ilanını silebilsin
CREATE POLICY "owner_delete_listings" ON listings
  FOR DELETE USING (auth.uid() = user_id);

-- ── profiles tablosu ────────────────────────────────────────

-- Önceki yanlış politikayı temizle
DROP POLICY IF EXISTS "owner_profile" ON profiles;

-- Herkes profili okuyabilsin (ilan sahibi bilgisi için)
CREATE POLICY "public_read_profiles" ON profiles
  FOR SELECT USING (true);

-- Sadece kendi profilini güncelleyebilsin
CREATE POLICY "owner_update_profiles" ON profiles
  FOR UPDATE USING (auth.uid() = id);
