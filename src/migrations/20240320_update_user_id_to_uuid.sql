-- Update users table
ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid;

-- Update posts table
ALTER TABLE posts ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Update any other tables that reference user_id
ALTER TABLE comments ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE post_likes ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE notifications ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE recent_searches ALTER COLUMN user_id TYPE uuid USING user_id::uuid; 