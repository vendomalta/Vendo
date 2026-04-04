-- ============================================================
-- VENDO - GÜNLÜK YEDEK / DAILY BACKUP
-- Tarih / Date: 2026-04-01
-- Bu dosya 01 Nisan 2026 tarihinde Supabase'e uygulanan
-- tüm SQL değişikliklerini içermektedir.
-- ============================================================


-- ============================================================
-- 1. RAPORLAMA SİSTEMİ KURULUMU (reports_setup.sql)
-- İlan ve mesaj raporlarını admin paneline bağlayan yapılandırma.
-- ============================================================

-- 1a. report_type kolonu yoksa ekle (listing / message ayrımı için)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='report_type') THEN
        ALTER TABLE public.reports ADD COLUMN report_type TEXT DEFAULT 'listing';
    END IF;
END $$;

-- 1b. Foreign key'leri public.profiles'a bağla (admin paneli join yapabilsin diye)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;

ALTER TABLE public.reports 
    ADD CONSTRAINT reports_reporter_id_fkey 
    FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
    ADD CONSTRAINT reports_reported_id_fkey 
    FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 1c. Hatalı/eşleşmeyen eski raporları temizle
DELETE FROM public.reports 
WHERE reporter_id NOT IN (SELECT id FROM public.profiles)
   OR (reported_id IS NOT NULL AND reported_id NOT IN (SELECT id FROM public.profiles));

-- 1d. RLS Politikalarını tanımla
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can manage all reports" ON public.reports;
CREATE POLICY "Admins can manage all reports" ON public.reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
        )
    );

-- 1e. Admin paneli için hızlandırma indeksleri
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);


-- ============================================================
-- 2. GERÇEK ZAMANLI (REALTIME) ONAY GÜNCELLEMESİ
-- transaction_approvals tablosunu Supabase Realtime listesine ekle.
-- NOT: Bu tablo zaten listedeydi (hata mesajı verdi, sorun değil).
-- ============================================================

-- Bu komut zaten uygulanmaya çalışıldı, tablo zaten listede:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_approvals;
-- Hata: relation "transaction_approvals" is already member of publication "supabase_realtime"
-- Durum: BAŞARILI (Zaten aktif)


-- ============================================================
-- 3. SATILDI OTOMATİK İŞARETLEME
-- Her iki taraf onayladığında ilanı otomatik 'sold' yap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_complete_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer hem alıcı hem satıcı onay verdiyse ve işlem henüz tamamlanmadıysa
    IF NEW.buyer_approved = TRUE AND NEW.seller_approved = TRUE AND NEW.transaction_completed = FALSE THEN
        -- 1. İşlemi tamamlandı olarak işaretle
        NEW.transaction_completed = TRUE;
        NEW.transaction_completed_at = NOW();

        -- 2. İlgili ilanı 'sold' (satıldı) durumuna çek
        UPDATE public.listings 
        SET status = 'sold'
        WHERE id = NEW.listing_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ın var olduğundan emin ol (02_functions_and_triggers.sql'de zaten vardı)
DROP TRIGGER IF EXISTS tr_transaction_auto_complete ON public.transaction_approvals;
CREATE TRIGGER tr_transaction_auto_complete 
    BEFORE UPDATE ON public.transaction_approvals 
    FOR EACH ROW 
    EXECUTE FUNCTION public.auto_complete_transaction();


-- ============================================================
-- YEDEK TAMAMLANDI
-- ============================================================
