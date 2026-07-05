-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false;

-- Replace the unconditional no-overlap exclusion constraint with a partial one
-- that ignores retired slots. A retired slot keeps its original startTime/endTime
-- forever (a cancelled booking's history depends on that being accurate) but
-- should no longer block a brand new slot from being created over that time range.
ALTER TABLE "Slot" DROP CONSTRAINT "slot_no_overlap_per_mentor";

ALTER TABLE "Slot" ADD CONSTRAINT "slot_no_overlap_per_mentor"
  EXCLUDE USING gist (
    "mentorProfileId" WITH =,
    tsrange("startTime", "endTime") WITH &&
  ) WHERE ("retired" = false);
