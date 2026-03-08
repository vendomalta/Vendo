    -- ============================================
-- İLAN SORU-CEVAP SİSTEMİ
-- ============================================
-- İlan detay sayfalarında kullanıcılar soru sorabilir,
-- herkes cevap verebilir, kullanıcılar kendi içeriklerini düzenleyebilir/silebilir

-- 1. Sorular Tablosu
CREATE TABLE IF NOT EXISTS public.listing_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 5 AND 1000),
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Cevaplar Tablosu
CREATE TABLE IF NOT EXISTS public.listing_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.listing_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL CHECK (char_length(answer_text) BETWEEN 1 AND 1000),
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

    -- 3. İndeksler (Performans)
CREATE INDEX IF NOT EXISTS idx_listing_questions_listing_id ON public.listing_questions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_questions_user_id ON public.listing_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_questions_created_at ON public.listing_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_answers_question_id ON public.listing_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_listing_answers_user_id ON public.listing_answers(user_id);

    -- 4. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_listing_questions_updated_at
    BEFORE UPDATE ON public.listing_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_listing_answers_updated_at ON public.listing_answers;
CREATE TRIGGER update_listing_answers_updated_at
    BEFORE UPDATE ON public.listing_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

    -- 5. RLS (Row Level Security) Politikaları
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_answers ENABLE ROW LEVEL SECURITY;

-- Herkes soruları okuyabilir (public listing için)
DROP POLICY IF EXISTS "Sorular herkese açık" ON public.listing_questions;
CREATE POLICY "Sorular herkese açık"
    ON public.listing_questions
    FOR SELECT
    USING (true);

-- Giriş yapmış kullanıcılar soru sorabilir
DROP POLICY IF EXISTS "Kullanıcılar soru sorabilir" ON public.listing_questions;
CREATE POLICY "Kullanıcılar soru sorabilir"
    ON public.listing_questions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi sorularını güncelleyebilir
DROP POLICY IF EXISTS "Kullanıcılar kendi sorularını güncelleyebilir" ON public.listing_questions;
CREATE POLICY "Kullanıcılar kendi sorularını güncelleyebilir"
    ON public.listing_questions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi sorularını silebilir
DROP POLICY IF EXISTS "Kullanıcılar kendi sorularını silebilir" ON public.listing_questions;
CREATE POLICY "Kullanıcılar kendi sorularını silebilir"
    ON public.listing_questions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Herkes cevapları okuyabilir
DROP POLICY IF EXISTS "Cevaplar herkese açık" ON public.listing_answers;
CREATE POLICY "Cevaplar herkese açık"
    ON public.listing_answers
    FOR SELECT
    USING (true);

-- Giriş yapmış kullanıcılar cevap yazabilir
DROP POLICY IF EXISTS "Kullanıcılar cevap yazabilir" ON public.listing_answers;
CREATE POLICY "Kullanıcılar cevap yazabilir"
    ON public.listing_answers
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi cevaplarını güncelleyebilir
DROP POLICY IF EXISTS "Kullanıcılar kendi cevaplarını güncelleyebilir" ON public.listing_answers;
CREATE POLICY "Kullanıcılar kendi cevaplarını güncelleyebilir"
    ON public.listing_answers
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi cevaplarını silebilir
DROP POLICY IF EXISTS "Kullanıcılar kendi cevaplarını silebilir" ON public.listing_answers;
CREATE POLICY "Kullanıcılar kendi cevaplarını silebilir"
    ON public.listing_answers
    FOR DELETE
    USING (auth.uid() = user_id);

    -- ============================================
-- BAŞARILI! Supabase SQL Editor'da çalıştırın
-- ============================================

-- NOT: View'lar kullanmıyoruz, JavaScript doğrudan tablolardan okuyacak
