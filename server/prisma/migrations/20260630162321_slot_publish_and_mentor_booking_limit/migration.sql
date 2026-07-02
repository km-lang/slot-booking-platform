-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "allocatedBy" TEXT,
ADD COLUMN     "mentorProfileId" TEXT;

-- Backfill mentorProfileId from each booking's slot before enforcing NOT NULL
UPDATE "Booking" b
SET "mentorProfileId" = s."mentorProfileId"
FROM "Slot" s
WHERE s.id = b."slotId";

ALTER TABLE "Booking" ALTER COLUMN "mentorProfileId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "MentorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A student may hold at most one CONFIRMED booking per mentor at a time.
-- Partial unique index (Prisma's schema DSL can't express a conditional unique constraint).
CREATE UNIQUE INDEX "booking_one_active_per_mentor" ON "Booking"("studentUserId", "mentorProfileId") WHERE status = 'CONFIRMED';
