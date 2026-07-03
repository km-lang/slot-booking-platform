-- Cancellation redesign: remove automatic warning/strike-on-timing, replace
-- with mentor-reviewed manual strikes. See bookingController.js for the
-- corresponding application logic.

-- Track who cancelled a booking (only ever STUDENT today — no mentor-cancel
-- path exists in this app) and when.
ALTER TABLE "Booking" ADD COLUMN "cancelledBy" "Role";
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Track which mentor manually issued a strike (or, for the pre-existing
-- NO_SHOW path, which mentor marked the no-show) — mirrors Ban.liftedBy.
ALTER TABLE "StudentWarning" ADD COLUMN "issuedBy" TEXT;

-- Backfill: every CANCELLED booking that exists today predates this change
-- and was necessarily student-initiated, since no other cancellation path
-- has ever existed in this codebase. cancelledAt is left NULL for these —
-- the real cancellation time was never recorded, and createdAt (booking
-- creation, not cancellation) would be a misleading substitute.
UPDATE "Booking" SET "cancelledBy" = 'STUDENT'
WHERE "status" = 'CANCELLED' AND "cancelledBy" IS NULL;
