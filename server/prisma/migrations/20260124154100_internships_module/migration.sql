-- Internships module tables

-- enums
DO $$ BEGIN
  CREATE TYPE "InternshipType" AS ENUM ('free','paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InternshipApplicationStatus" AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Internship
CREATE TABLE IF NOT EXISTS "Internship" (
  "id" INTEGER PRIMARY KEY,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "type" "InternshipType" NOT NULL,
  "xpRequired" INTEGER NOT NULL,
  "salary" TEXT,
  "duration" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "description" TEXT NOT NULL,
  "applicants" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Application
CREATE TABLE IF NOT EXISTS "InternshipApplication" (
  "id" TEXT PRIMARY KEY,
  "internshipId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "InternshipApplicationStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "portfolio" TEXT,
  "linkedin" TEXT,
  "github" TEXT,
  "location" TEXT,
  "phone" TEXT,
  "coverLetter" TEXT,
  "offerSubject" TEXT,
  "offerBody" TEXT,
  CONSTRAINT "InternshipApplication_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternshipApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternshipApplication_internshipId_userId_key" ON "InternshipApplication"("internshipId","userId");

-- Enrollment
CREATE TABLE IF NOT EXISTS "InternshipEnrollment" (
  "id" TEXT PRIMARY KEY,
  "internshipId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalXP" INTEGER NOT NULL DEFAULT 0,
  "earnedXP" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternshipEnrollment_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternshipEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternshipEnrollment_internshipId_userId_key" ON "InternshipEnrollment"("internshipId","userId");

-- Tasks
CREATE TABLE IF NOT EXISTS "InternshipTask" (
  "id" TEXT PRIMARY KEY,
  "internshipId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "week" INTEGER NOT NULL,
  "xpReward" INTEGER NOT NULL,
  "attachmentType" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternshipTask_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Submissions
CREATE TABLE IF NOT EXISTS "InternshipSubmission" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "fileName" TEXT,
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternshipSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InternshipTask"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InternshipSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InternshipSubmission_taskId_userId_key" ON "InternshipSubmission"("taskId","userId");
