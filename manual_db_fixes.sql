-- Manual PostgreSQL queries to fix database tables

-- 1. First, let's check the current structure of the posts table
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'posts' 
ORDER BY ordinal_position;

-- 2. Create a backup of the posts table
CREATE TABLE IF NOT EXISTS posts_backup AS SELECT * FROM posts;

-- 3. Add missing columns to the posts table
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS unique_traceability_id VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;

-- 4. If video_url exists but videoUrl doesn't, rename the column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'video_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'videoUrl'
  ) THEN
    ALTER TABLE posts RENAME COLUMN video_url TO "videoUrl";
  END IF;
END
$$;

-- 5. If the id column is UUID, convert it to INTEGER (be careful with this one!)
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns 
--     WHERE table_name = 'posts' AND column_name = 'id' AND data_type = 'uuid'
--   ) THEN
--     -- Create a new sequence for the integer IDs
--     CREATE SEQUENCE IF NOT EXISTS posts_id_seq;
--     
--     -- Create a temporary table with the new structure
--     CREATE TABLE posts_new (
--       id INTEGER PRIMARY KEY DEFAULT nextval('posts_id_seq'),
--       unique_traceability_id VARCHAR(255) UNIQUE,
--       title VARCHAR(255) NOT NULL,
--       content TEXT,
--       description TEXT,
--       status VARCHAR(50) DEFAULT 'pending',
--       user_id INTEGER,
--       views INTEGER DEFAULT 0,
--       likes INTEGER DEFAULT 0,
--       shares INTEGER DEFAULT 0,
--       "videoUrl" VARCHAR(255),
--       "createdAt" TIMESTAMP WITH TIME ZONE,
--       "updatedAt" TIMESTAMP WITH TIME ZONE
--     );
--     
--     -- Copy data from old table to new table
--     INSERT INTO posts_new (
--       unique_traceability_id, title, content, description, status, 
--       user_id, views, likes, shares, "videoUrl", "createdAt", "updatedAt"
--     )
--     SELECT 
--       unique_traceability_id, title, description, description, status, 
--       user_id::integer, 0, 0, 0, "videoUrl", "createdAt", "updatedAt"
--     FROM posts;
--     
--     -- Drop the old table and rename the new one
--     DROP TABLE posts;
--     ALTER TABLE posts_new RENAME TO posts;
--     
--     -- Set the sequence to the max id
--     SELECT setval('posts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM posts), true);
--   END IF;
-- END
-- $$;

-- 6. Update the Post model to use 'content' instead of 'description'
-- This is a reminder to update your Sequelize model if needed

-- 7. Check if the content column exists now
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'content';

-- 8. If you need to copy data from description to content
UPDATE posts 
SET content = description 
WHERE content IS NULL AND description IS NOT NULL;

-- 9. Check the users table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 10. Check the categories table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'categories' 
ORDER BY ordinal_position;

-- 11. Check the comments table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'comments' 
ORDER BY ordinal_position; 