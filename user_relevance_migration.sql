-- Add relevance tracking fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Update follower_count for existing users based on actual follower count
UPDATE users u
SET follower_count = (
  SELECT COUNT(*) 
  FROM follows 
  WHERE following_id = u.id
);

-- Update post_count for existing users if not already accurate
UPDATE users u
SET posts_count = (
  SELECT COUNT(*)
  FROM posts
  WHERE user_id = u.id
);

-- Create index for faster queries on these fields
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_date);
CREATE INDEX IF NOT EXISTS idx_users_follower_count ON users(follower_count);

-- If you need to rollback:
-- ALTER TABLE users 
-- DROP COLUMN IF EXISTS last_active_date,
-- DROP COLUMN IF EXISTS follower_count,
-- DROP COLUMN IF EXISTS interests; 