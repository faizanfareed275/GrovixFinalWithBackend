-- AlterEnum
ALTER TYPE "StoredFilePurpose" ADD VALUE 'INTERNSHIP_IMAGE';

-- AlterTable
ALTER TABLE "Internship" ADD COLUMN     "imageFileId" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
