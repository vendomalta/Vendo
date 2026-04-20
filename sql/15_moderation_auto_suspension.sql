-- ============================================================
-- VENDO MODERATION SYSTEM - AUTO SUSPENSION & PROTECTION
-- ============================================================

-- 1. Modify listings table
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE;

-- 2. Add 'suspended' to listing_status_enum
-- Note: In PostgreSQL, you cannot add enum values inside a transaction block in some versions,
-- but for Supabase/Postgres 12+, this should work if not in a multi-statement transaction.
-- We use a DO block to check if it exists first.
DO $$ BEGIN
    ALTER TYPE public.listing_status_enum ADD VALUE 'suspended';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Auto-Suspension Function
CREATE OR REPLACE FUNCTION public.handle_auto_suspension()
RETURNS TRIGGER AS $$
DECLARE
    v_report_count INT;
    v_is_protected BOOLEAN;
BEGIN
    -- Only handle listing reports
    IF NEW.report_type != 'listing' OR NEW.listing_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if listing is protected
    SELECT is_protected INTO v_is_protected 
    FROM public.listings 
    WHERE id = NEW.listing_id;

    IF v_is_protected THEN
        RETURN NEW;
    END IF;

    -- Count unique reporters for this listing
    SELECT COUNT(DISTINCT reporter_id) INTO v_report_count
    FROM public.reports
    WHERE listing_id = NEW.listing_id;

    -- If 5 or more unique reports, suspend the listing
    IF v_report_count >= 5 THEN
        UPDATE public.listings
        SET status = 'suspended',
            updated_at = NOW()
        WHERE id = NEW.listing_id;
        
        -- Optional: Log the suspension
        -- INSERT INTO public.security_logs (user_id, event_type, details)
        -- VALUES (NEW.reporter_id, 'auto_suspension', jsonb_build_object('listing_id', NEW.listing_id, 'report_count', v_report_count));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Trigger on Reports Table
DROP TRIGGER IF EXISTS tr_auto_suspension ON public.reports;
CREATE TRIGGER tr_auto_suspension
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_auto_suspension();

-- 5. Admin Function to Approve & Protect
CREATE OR REPLACE FUNCTION public.approve_and_protect_listing(p_listing_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Reset status to active and protect from future suspensions
    UPDATE public.listings
    SET status = 'active',
        is_protected = TRUE,
        updated_at = NOW()
    WHERE id = p_listing_id;
    
    -- Mark reports as resolved (optional)
    UPDATE public.reports
    SET status = 'resolved'
    WHERE listing_id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
