-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "sigfiCohortId" TEXT;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_sigfiCohortId_fkey" FOREIGN KEY ("sigfiCohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
