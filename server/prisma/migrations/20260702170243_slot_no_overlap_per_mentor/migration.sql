-- Prevents a mentor from ever having two Slot rows with overlapping time
-- ranges, enforced at the database level (not just application code) so it
-- holds under concurrent/duplicate requests the same way the SlotCapacity
-- atomic-claim and one-booking-per-mentor partial-index fixes already do.
--
-- btree_gist is required for a GiST exclusion constraint to also compare a
-- plain equality column (mentorProfileId) alongside the range overlap check.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Slot" ADD CONSTRAINT "slot_no_overlap_per_mentor"
  EXCLUDE USING gist (
    "mentorProfileId" WITH =,
    tsrange("startTime", "endTime") WITH &&
  );
