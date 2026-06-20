"use strict";

// Phase 2 stub — full implementation in Phase 4.

const listAigs = async (_req, res, next) => {
  try {
    // TODO Phase 4: prisma.aIG.findMany({ include: { _count: { select: { mentorProfiles: true } } } })
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const getAig = async (req, res, next) => {
  try {
    // TODO Phase 4: prisma.aIG.findUnique({ where: { slug: req.params.slug } })
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const listMentors = async (req, res, next) => {
  try {
    // TODO Phase 4: filter by aigSlug query param; include liveSlots count
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const getMentor = async (req, res, next) => {
  try {
    // TODO Phase 4: prisma.mentorProfile.findUnique({ where: { slug: req.params.slug } })
    // Returns: { id, slug, name, firm, domain, cohortId, aig }
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const listSlots = async (req, res, next) => {
  try {
    // TODO Phase 4:
    // 1. Find mentor by slug query param
    // 2. Load slots with capacity
    // 3. For each slot, derive status: AVAILABLE | BOOKED_BY_ME | BOOKED_BY_OTHER
    //    using req.user.id to check Booking.studentUserId
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const releaseSlots = async (req, res, next) => {
  try {
    // TODO Phase 4:
    // 1. Parse startTime, endTime, slotDuration, venue, cohortOnly from body
    // 2. Create BookingRelease row
    // 3. Generate individual Slot rows for each interval + SlotCapacity rows
    // 4. Log AuditEvent SLOT_RELEASED
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const deleteSlot = async (req, res, next) => {
  try {
    // TODO Phase 4: soft-delete or hard-delete if no active bookings
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

const getMentorCohort = async (req, res, next) => {
  try {
    // TODO Phase 4: load cohort + members scoped to req.user's mentorProfile.cohortId
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAigs,
  getAig,
  listMentors,
  getMentor,
  listSlots,
  releaseSlots,
  deleteSlot,
  getMentorCohort,
};
