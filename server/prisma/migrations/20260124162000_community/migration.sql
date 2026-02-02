-- Community tables (posts + discussions)

CREATE TABLE IF NOT EXISTS "CommunityPost" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "user" TEXT NOT NULL,
  "avatar" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "timeAgo" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "xp" INTEGER NOT NULL DEFAULT 0,
  "likes" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "liked" BOOLEAN NOT NULL DEFAULT FALSE,
  "saved" BOOLEAN NOT NULL DEFAULT FALSE,
  "comments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "reactions" JSONB,
  "userReaction" TEXT,
  "poll" JSONB,
  "aiScore" INTEGER,
  "aiReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CommunityDiscussion" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "avatar" TEXT NOT NULL,
  "replies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "views" INTEGER NOT NULL DEFAULT 0,
  "hot" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityDiscussion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
