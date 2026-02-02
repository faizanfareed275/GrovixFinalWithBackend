-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "likesBy" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reactionsBy" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "savesBy" JSONB NOT NULL DEFAULT '[]';
