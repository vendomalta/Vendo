-- ============================================
-- FIX Q&A SCHEMA & STANDARDIZATION
-- ============================================

-- 1. Ensure listing_questions has correct columns
-- Rename listing_id references if needed, but we keep it.
-- We fix question -> question_text if it exists, or ensure it's question_text.

DO $$ 
BEGIN
    -- If listing_questions already exists but has 'question' column instead of 'question_text'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_questions' AND column_name='question') THEN
        ALTER TABLE public.listing_questions RENAME COLUMN question TO question_text;
    END IF;

    -- If listing_questions has questioner_id, rename to user_id for consistency with answers
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listing_questions' AND column_name='questioner_id') THEN
        ALTER TABLE public.listing_questions RENAME COLUMN questioner_id TO user_id;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.listing_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 5 AND 1000),
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure listing_answers exists
CREATE TABLE IF NOT EXISTS public.listing_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.listing_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL CHECK (char_length(answer_text) BETWEEN 1 AND 1000),
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS Policies
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_answers ENABLE ROW LEVEL SECURITY;

-- Questions
DROP POLICY IF EXISTS "Questions are public" ON public.listing_questions;
CREATE POLICY "Questions are public" ON public.listing_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can ask questions" ON public.listing_questions;
CREATE POLICY "Users can ask questions" ON public.listing_questions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own questions" ON public.listing_questions;
CREATE POLICY "Users can update own questions" ON public.listing_questions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own questions" ON public.listing_questions;
CREATE POLICY "Users can delete own questions" ON public.listing_questions FOR DELETE USING (auth.uid() = user_id);

-- Answers
DROP POLICY IF EXISTS "Answers are public" ON public.listing_answers;
CREATE POLICY "Answers are public" ON public.listing_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can write answers" ON public.listing_answers;
CREATE POLICY "Users can write answers" ON public.listing_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own answers" ON public.listing_answers;
CREATE POLICY "Users can update own answers" ON public.listing_answers FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own answers" ON public.listing_answers;
CREATE POLICY "Users can delete own answers" ON public.listing_answers FOR DELETE USING (auth.uid() = user_id);
