-- GD and CASE bookings are no longer capped at one active booking per mentor —
-- a student may hold any number of simultaneous GD or CASE bookings with the
-- same mentor. CV and STOCK_PITCH keep the existing one-per-(mentor, focus) cap.
-- See the comment on the Booking model in schema.prisma for the full rationale.
DROP INDEX "booking_one_active_per_mentor_type";

CREATE UNIQUE INDEX "booking_one_active_per_mentor_type" ON "Booking"("studentUserId", "mentorProfileId", "slotType", (COALESCE("focus", ''))) WHERE status = 'CONFIRMED' AND "slotType" NOT IN ('GD', 'CASE');
