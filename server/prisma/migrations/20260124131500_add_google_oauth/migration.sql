-- Add Google OAuth fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

-- Unique constraint on googleId (allows multiple NULLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_googleId_key'
  ) THEN
    CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
  END IF;
END$$;
