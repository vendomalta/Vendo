-- ============================================================
-- VENDO SYSTEM - PERMANENT REPORTING SETUP
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Modify existing reports table to support public joins
-- We drop existing foreign keys that point to auth.users if they exist
-- and point them to public.profiles so the admin panel can join them.

DO $$ BEGIN
    -- Add report_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='report_type') THEN
        ALTER TABLE public.reports ADD COLUMN report_type TEXT DEFAULT 'listing';
    END IF;
END $$;

-- 2. Ensure foreign keys point to public.profiles (for client-side joins)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;

ALTER TABLE public.reports 
    ADD CONSTRAINT reports_reporter_id_fkey 
    FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.reports 
    ADD CONSTRAINT reports_reported_id_fkey 
    FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Set up RLS Policies for Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own reports
DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Allow Admins to see all reports (Sync with Mobile Fix)
DROP POLICY IF EXISTS "Admins can manage all reports" ON public.reports;
CREATE POLICY "Admins can manage all reports" ON public.reports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
        )
    );

-- 4. Create an index for faster queries in admin panel
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ============================================================
-- SETUP COMPLETE
-- ============================================================
