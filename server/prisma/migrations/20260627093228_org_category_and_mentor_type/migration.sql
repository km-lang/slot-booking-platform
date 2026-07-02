-- CreateEnum
CREATE TYPE "OrgCategory" AS ENUM ('COMMITTEE', 'CLUB', 'AIG');

-- CreateEnum
CREATE TYPE "MentorType" AS ENUM ('ALUMNI', 'PGP2_STUDENT');

-- DropForeignKey
ALTER TABLE "MentorProfile" DROP CONSTRAINT "MentorProfile_aigId_fkey";

-- AlterTable
ALTER TABLE "AIG" ADD COLUMN     "category" "OrgCategory" NOT NULL DEFAULT 'AIG';

-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "mentorType" "MentorType" NOT NULL DEFAULT 'ALUMNI',
ALTER COLUMN "aigId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_aigId_fkey" FOREIGN KEY ("aigId") REFERENCES "AIG"("id") ON DELETE SET NULL ON UPDATE CASCADE;
