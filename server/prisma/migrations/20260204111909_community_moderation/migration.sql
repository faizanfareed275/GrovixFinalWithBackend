/*
  Warnings:

  - A unique constraint covering the columns `[internshipCode]` on the table `Internship` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[batchId,userId]` on the table `InternshipApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CommunityContentStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CommunityReportTargetType" AS ENUM ('POST', 'POST_COMMENT', 'DISCUSSION', 'DISCUSSION_REPLY', 'USER');

-- CreateEnum
CREATE TYPE "CommunityModerationActionType" AS ENUM ('REMOVE_CONTENT', 'RESTORE_CONTENT', 'ISSUE_WARNING', 'TEMP_BAN', 'PERM_BAN');

-- CreateEnum
CREATE TYPE "CommunityModerationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CommunityGuidelineStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "InternshipBatchStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'RUNNING', 'ENDED');

-- CreateEnum
CREATE TYPE "InternshipEnrollmentStatus" AS ENUM ('ACTIVE', 'FROZEN', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "InternshipAccessMode" AS ENUM ('FULL', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "InternshipBadgeLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "InternshipTaskAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED', 'LOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InternshipSubmissionStatus" AS ENUM ('SUBMITTED', 'RESUBMITTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InternshipGradeStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "StoredFilePurpose" AS ENUM ('OFFER_LETTER', 'TASK_ATTACHMENT', 'TASK_SUBMISSION', 'CERTIFICATE');

-- DropIndex
DROP INDEX "InternshipApplication_internshipId_userId_key";

-- AlterTable
ALTER TABLE "CommunityDiscussion" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removalGuidelineId" TEXT,
ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedByUserId" TEXT,
ADD COLUMN     "status" "CommunityContentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "removalGuidelineId" TEXT,
ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedByUserId" TEXT,
ADD COLUMN     "status" "CommunityContentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
CREATE SEQUENCE internship_id_seq;
ALTER TABLE "Internship" ADD COLUMN     "internshipCode" TEXT,
ALTER COLUMN "id" SET DEFAULT nextval('internship_id_seq');
ALTER SEQUENCE internship_id_seq OWNED BY "Internship"."id";

-- AlterTable
ALTER TABLE "InternshipApplication" ADD COLUMN     "batchId" INTEGER,
ADD COLUMN     "offerFileId" TEXT;

-- AlterTable
ALTER TABLE "InternshipEnrollment" ADD COLUMN     "accessMode" "InternshipAccessMode" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "batchId" INTEGER,
ADD COLUMN     "currentBadge" "InternshipBadgeLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "frozenAt" TIMESTAMP(3),
ADD COLUMN     "readOnlyAt" TIMESTAMP(3),
ADD COLUMN     "status" "InternshipEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "terminatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedBy" TEXT,
ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CommunityDiscussionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityDiscussionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGuideline" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "CommunityGuidelineStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "CommunityReportTargetType" NOT NULL,
    "targetLegacyId" BIGINT,
    "targetNodeId" BIGINT,
    "targetUserId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "severity" "CommunityModerationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionActionId" TEXT,
    "guidelineId" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityModerationAction" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actionType" "CommunityModerationActionType" NOT NULL,
    "targetType" "CommunityReportTargetType" NOT NULL,
    "targetLegacyId" BIGINT,
    "targetNodeId" BIGINT,
    "targetUserId" TEXT,
    "reportId" TEXT,
    "guidelineId" TEXT,
    "reason" TEXT NOT NULL,
    "durationHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "meta" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipBatch" (
    "id" SERIAL NOT NULL,
    "internshipId" INTEGER NOT NULL,
    "batchCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "applicationOpenAt" TIMESTAMP(3),
    "applicationCloseAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "status" "InternshipBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipBadgeRule" (
    "id" TEXT NOT NULL,
    "internshipId" INTEGER NOT NULL,
    "level" "InternshipBadgeLevel" NOT NULL,
    "minCompletionPercent" INTEGER NOT NULL DEFAULT 0,
    "minXp" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipBadgeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipTaskTemplate" (
    "id" TEXT NOT NULL,
    "internshipId" INTEGER NOT NULL,
    "badgeLevel" "InternshipBadgeLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unlockOffsetDays" INTEGER,
    "timePeriodDays" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "autoPass" BOOLEAN NOT NULL DEFAULT false,
    "rubricJson" JSONB,
    "gradingNotes" TEXT,
    "attachmentFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipTaskAssignment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "InternshipTaskAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "remainingAttempts" INTEGER NOT NULL DEFAULT 1,
    "latestGradeStatus" "InternshipGradeStatus" NOT NULL DEFAULT 'PENDING',
    "passedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipTaskAttempt" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" "InternshipSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileId" TEXT,
    "fileName" TEXT,
    "notes" TEXT,
    "gradedBy" TEXT,
    "gradedAt" TIMESTAMP(3),
    "gradeStatus" "InternshipGradeStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "maxScore" INTEGER,
    "feedback" TEXT,
    "rubricScores" JSONB,

    CONSTRAINT "InternshipTaskAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipCertificate" (
    "id" TEXT NOT NULL,
    "internshipId" INTEGER NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "certificateCode" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT,
    "qrPayload" TEXT,

    CONSTRAINT "InternshipCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "purpose" "StoredFilePurpose" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "storageProvider" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityDiscussionCategory_name_key" ON "CommunityDiscussionCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityDiscussionCategory_slug_key" ON "CommunityDiscussionCategory"("slug");

-- CreateIndex
CREATE INDEX "CommunityDiscussionCategory_isActive_sortOrder_idx" ON "CommunityDiscussionCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityGuideline_slug_key" ON "CommunityGuideline"("slug");

-- CreateIndex
CREATE INDEX "CommunityGuideline_status_publishedAt_idx" ON "CommunityGuideline"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CommunityReport_status_createdAt_idx" ON "CommunityReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_targetType_targetLegacyId_idx" ON "CommunityReport"("targetType", "targetLegacyId");

-- CreateIndex
CREATE INDEX "CommunityReport_reporterUserId_createdAt_idx" ON "CommunityReport"("reporterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_actorUserId_createdAt_idx" ON "CommunityModerationAction"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_targetType_targetLegacyId_idx" ON "CommunityModerationAction"("targetType", "targetLegacyId");

-- CreateIndex
CREATE INDEX "CommunityModerationAction_reportId_idx" ON "CommunityModerationAction"("reportId");

-- CreateIndex
CREATE INDEX "CommunityNotification_userId_createdAt_idx" ON "CommunityNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityNotification_userId_readAt_idx" ON "CommunityNotification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipBatch_batchCode_key" ON "InternshipBatch"("batchCode");

-- CreateIndex
CREATE INDEX "InternshipBatch_internshipId_idx" ON "InternshipBatch"("internshipId");

-- CreateIndex
CREATE INDEX "InternshipBatch_status_idx" ON "InternshipBatch"("status");

-- CreateIndex
CREATE INDEX "InternshipBadgeRule_internshipId_sortOrder_idx" ON "InternshipBadgeRule"("internshipId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipBadgeRule_internshipId_level_key" ON "InternshipBadgeRule"("internshipId", "level");

-- CreateIndex
CREATE INDEX "InternshipTaskTemplate_internshipId_badgeLevel_sortOrder_idx" ON "InternshipTaskTemplate"("internshipId", "badgeLevel", "sortOrder");

-- CreateIndex
CREATE INDEX "InternshipTaskAssignment_enrollmentId_status_idx" ON "InternshipTaskAssignment"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "InternshipTaskAssignment_templateId_idx" ON "InternshipTaskAssignment"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipTaskAssignment_enrollmentId_templateId_key" ON "InternshipTaskAssignment"("enrollmentId", "templateId");

-- CreateIndex
CREATE INDEX "InternshipTaskAttempt_assignmentId_submittedAt_idx" ON "InternshipTaskAttempt"("assignmentId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipTaskAttempt_assignmentId_attemptNo_key" ON "InternshipTaskAttempt"("assignmentId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipCertificate_enrollmentId_key" ON "InternshipCertificate"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipCertificate_certificateCode_key" ON "InternshipCertificate"("certificateCode");

-- CreateIndex
CREATE INDEX "InternshipCertificate_internshipId_idx" ON "InternshipCertificate"("internshipId");

-- CreateIndex
CREATE INDEX "StoredFile_purpose_idx" ON "StoredFile"("purpose");

-- CreateIndex
CREATE INDEX "StoredFile_createdAt_idx" ON "StoredFile"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunityDiscussion_status_createdAt_idx" ON "CommunityDiscussion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityDiscussion_category_createdAt_idx" ON "CommunityDiscussion"("category", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_status_createdAt_idx" ON "CommunityPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_userId_createdAt_idx" ON "CommunityPost"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Internship_internshipCode_key" ON "Internship"("internshipCode");

-- CreateIndex
CREATE INDEX "InternshipApplication_batchId_idx" ON "InternshipApplication"("batchId");

-- CreateIndex
CREATE INDEX "InternshipApplication_internshipId_status_idx" ON "InternshipApplication"("internshipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipApplication_batchId_userId_key" ON "InternshipApplication"("batchId", "userId");

-- CreateIndex
CREATE INDEX "InternshipEnrollment_batchId_idx" ON "InternshipEnrollment"("batchId");

-- CreateIndex
CREATE INDEX "InternshipEnrollment_userId_status_idx" ON "InternshipEnrollment"("userId", "status");

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityModerationAction" ADD CONSTRAINT "CommunityModerationAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityNotification" ADD CONSTRAINT "CommunityNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipBatch" ADD CONSTRAINT "InternshipBatch_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InternshipBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_offerFileId_fkey" FOREIGN KEY ("offerFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipEnrollment" ADD CONSTRAINT "InternshipEnrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InternshipBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipBadgeRule" ADD CONSTRAINT "InternshipBadgeRule_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskTemplate" ADD CONSTRAINT "InternshipTaskTemplate_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskTemplate" ADD CONSTRAINT "InternshipTaskTemplate_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskAssignment" ADD CONSTRAINT "InternshipTaskAssignment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternshipEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskAssignment" ADD CONSTRAINT "InternshipTaskAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InternshipTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskAttempt" ADD CONSTRAINT "InternshipTaskAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "InternshipTaskAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipTaskAttempt" ADD CONSTRAINT "InternshipTaskAttempt_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipCertificate" ADD CONSTRAINT "InternshipCertificate_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipCertificate" ADD CONSTRAINT "InternshipCertificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InternshipEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipCertificate" ADD CONSTRAINT "InternshipCertificate_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
