-- Add context_data field to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS context_data TEXT DEFAULT '{}';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_status ON notifications(is_read);

-- If you need to rollback:
-- ALTER TABLE notifications
-- DROP COLUMN IF EXISTS context_data; 