-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "followerId" UUID NOT NULL REFERENCES users(id),
  "followingId" UUID NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("followerId", "followingId")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows("followerId");
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows("followingId");

-- If you need to rollback:
-- DROP TABLE IF EXISTS follows; 