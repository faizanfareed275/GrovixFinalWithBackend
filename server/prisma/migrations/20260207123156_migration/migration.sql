-- AlterEnum
ALTER TYPE "StoredFilePurpose" ADD VALUE 'RESUME';

-- AlterTable
ALTER TABLE "InternshipApplication" ADD COLUMN     "resumeFileId" TEXT;

-- AddForeignKey
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_resumeFileId_fkey" FOREIGN KEY ("resumeFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
