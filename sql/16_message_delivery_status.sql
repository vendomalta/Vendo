-- ============================================================
-- VENDO DATABASE MIGRATION - 16_MESSAGE_DELIVERY_STATUS.sql
-- ============================================================

-- 1. Add delivery status columns to public.messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Update existing read messages to also be marked as delivered
UPDATE public.messages 
SET is_delivered = TRUE, delivered_at = read_at 
WHERE is_read = TRUE AND is_delivered = FALSE;

-- 3. Update existing unread messages to be delivered back to now (for a clean start)
-- Optional, but helps legacy messages show double checks if they were likely delivered
-- UPDATE public.messages SET is_delivered = TRUE, delivered_at = NOW() WHERE is_read = FALSE;
