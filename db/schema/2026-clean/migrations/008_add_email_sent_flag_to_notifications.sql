-- 008_add_email_sent_flag_to_notifications.sql
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
