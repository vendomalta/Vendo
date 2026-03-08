-- ============================================================
-- FIX: MESSAGES DELETE POLICY
-- ============================================================
-- Mesajların silinmesi için eksik RLS policy'sini ekle
-- Bu dosyayı Supabase SQL Editor'de çalıştırın
-- ============================================================

-- Messages tablosuna DELETE policy ekle
-- Kullanıcılar sadece kendi gönderdiği veya aldığı mesajları silebilir
DROP POLICY IF EXISTS "messages_delete_participant" ON public.messages;

CREATE POLICY "messages_delete_participant" ON public.messages
    FOR DELETE
    USING (
        auth.uid() = sender_id OR auth.uid() = receiver_id
    );

-- Doğrulama: Messages tablosundaki tüm policy'leri listele
DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'MESSAGES TABLE POLICIES:';
    RAISE NOTICE '============================================================';
END $$;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    qual as using_expression
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY policyname;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Messages DELETE policy başarıyla eklendi!';
    RAISE NOTICE '✅ Kullanıcılar artık kendi mesajlarını silebilir.';
    RAISE NOTICE '';
    RAISE NOTICE 'Policy Detayları:';
    RAISE NOTICE '  - SELECT: Gönderen veya alıcı okuyabilir';
    RAISE NOTICE '  - INSERT: Sadece gönderen olarak mesaj gönderebilir';
    RAISE NOTICE '  - UPDATE: Gönderen veya alıcı güncelleyebilir (is_read için)';
    RAISE NOTICE '  - DELETE: Gönderen veya alıcı silebilir ✅ YENİ!';
    RAISE NOTICE '';
    RAISE NOTICE 'Test için:';
    RAISE NOTICE '  1. Mesajlar sayfasına gidin';
    RAISE NOTICE '  2. "Toplu Sil" butonuna tıklayın';
    RAISE NOTICE '  3. Konuşmaları seçin ve silin';
    RAISE NOTICE '  4. Sayfa yenilendiğinde mesajlar gözükmeyecek';
    RAISE NOTICE '============================================================';
END $$;
