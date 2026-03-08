-- Intelligent Email Notification System Migration
-- Step 1: Add columns to profiles to track presence and notification status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_notified_offline BOOLEAN DEFAULT FALSE;

-- Step 2: Create a notification queue table
DROP TABLE IF EXISTS notification_queue CASCADE;
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- e.g., 'new_message'
    related_id TEXT, -- ID of the message or entity trigger (TEXT handles both UUID and BIGINT)
    content JSONB,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Index for efficient querying by the background worker
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status) WHERE status = 'pending';

-- Step 3: Create the intelligent trigger function
CREATE OR REPLACE FUNCTION handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_profile RECORD;
    recipient_prefs JSONB;
BEGIN
    -- Get recipient profile and preferences
    SELECT last_seen, is_notified_offline, (raw_user_meta_data->'preferences') as prefs
    INTO recipient_profile
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = NEW.receiver_id;

    -- LOGIC:
    -- 1. Check if recipient has message notifications enabled (default true)
    -- 2. Check if recipient is offline (not seen in last 5 minutes)
    -- 3. Check if recipient hasn't been notified yet since they went offline
    
    IF (recipient_profile.prefs->>'messages')::boolean IS NOT FALSE AND
       recipient_profile.last_seen < (NOW() - INTERVAL '5 minutes') AND
       recipient_profile.is_notified_offline = FALSE THEN
       
       -- Insert into queue
       INSERT INTO notification_queue (recipient_id, notification_type, related_id, content)
       VALUES (NEW.receiver_id, 'new_message', NEW.id::text, jsonb_build_object('sender_id', NEW.sender_id));
       
       -- Mark as notified to avoid spamming
       UPDATE profiles 
       SET is_notified_offline = TRUE 
       WHERE id = NEW.receiver_id;
       
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Attach trigger to messages table
-- Assuming the table is named 'messages' and has 'recipient_id' and 'sender_id'
-- Note: Replace 'messages' if your table name is different
DROP TRIGGER IF EXISTS tr_new_message_notification ON messages;
CREATE TRIGGER tr_new_message_notification
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION handle_new_message_notification();
