-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "slotType" "SlotType";

-- Backfill slotType from each booking's slot/release before enforcing NOT NULL
UPDATE "Booking" b
SET "slotType" = r."slotType"
FROM "Slot" s
JOIN "BookingRelease" r ON r.id = s."releaseId"
WHERE s.id = b."slotId";

ALTER TABLE "Booking" ALTER COLUMN "slotType" SET NOT NULL;

-- A student may now hold one CONFIRMED booking per mentor PER (slotType, focus)
-- instead of one per mentor overall — e.g. a CASE booking and a CV-HR booking with
-- the same mentor can now coexist, but not two CASE bookings, and not two CV
-- bookings of the same focus. Replaces booking_one_active_per_mentor.
-- COALESCE(focus, '') so GD/CASE/STOCK_PITCH bookings (focus IS NULL) still collide
-- with each other under this index — a plain unique index treats NULL <> NULL, which
-- would otherwise let a student hold two CASE bookings (or two GD, or two
-- STOCK_PITCH) with the same mentor at once.
DROP INDEX "booking_one_active_per_mentor";

CREATE UNIQUE INDEX "booking_one_active_per_mentor_type" ON "Booking"("studentUserId", "mentorProfileId", "slotType", (COALESCE("focus", ''))) WHERE status = 'CONFIRMED';
