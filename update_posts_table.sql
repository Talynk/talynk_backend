-- SQL query to update the posts table to match the Sequelize model

-- First, let's create a backup of the current table
CREATE TABLE posts_backup AS SELECT * FROM posts;

-- Now, let's modify the posts table to match the model
ALTER TABLE posts
  -- Ensure id is UUID
  ALTER COLUMN id TYPE uuid USING (id::text::uuid),
  
  -- Add unique_traceability_id if it doesn't exist
  ADD COLUMN IF NOT EXISTS unique_traceability_id VARCHAR(255) UNIQUE,
  
  -- Ensure title is not null
  ALTER COLUMN title SET NOT NULL,
  
  -- Add content column if it doesn't exist
  ADD COLUMN IF NOT EXISTS content TEXT,
  
  -- Ensure status has default 'pending'
  ALTER COLUMN status SET DEFAULT 'pending',
  
  -- Add views, likes, shares columns if they don't exist
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0,
  
  -- Rename video_url to videoUrl if needed
  RENAME COLUMN video_url TO videoUrl;

-- Set the default value for id to use uuid_generate_v4()
ALTER TABLE posts ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_posts_user' AND table_name = 'posts'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$; 