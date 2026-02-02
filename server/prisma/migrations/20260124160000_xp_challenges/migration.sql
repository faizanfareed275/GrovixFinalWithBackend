-- XP + Challenge completions

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ChallengeCompletion" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "challengeId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "xpEarned" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChallengeCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeCompletion_userId_challengeId_key" ON "ChallengeCompletion"("userId","challengeId");
