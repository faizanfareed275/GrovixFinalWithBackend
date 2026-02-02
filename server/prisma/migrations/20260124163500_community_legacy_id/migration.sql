-- Add legacyId to allow numeric client ids

ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS "legacyId" BIGINT;
ALTER TABLE "CommunityDiscussion" ADD COLUMN IF NOT EXISTS "legacyId" BIGINT;

-- Backfill legacyId for existing rows (use createdAt epoch ms)
UPDATE "CommunityPost"
SET "legacyId" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint
WHERE "legacyId" IS NULL;

UPDATE "CommunityDiscussion"
SET "legacyId" = (EXTRACT(EPOCH FROM "createdAt") * 1000)::bigint
WHERE "legacyId" IS NULL;

-- Enforce NOT NULL + unique
ALTER TABLE "CommunityPost" ALTER COLUMN "legacyId" SET NOT NULL;
ALTER TABLE "CommunityDiscussion" ALTER COLUMN "legacyId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CommunityPost_legacyId_key" ON "CommunityPost"("legacyId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityDiscussion_legacyId_key" ON "CommunityDiscussion"("legacyId");
