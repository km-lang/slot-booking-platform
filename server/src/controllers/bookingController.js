"use strict";

// Phase 2 stub — full OCC implementation in Phase 4.
//
// OCC flow (createBooking):
//   1. Check idempotencyKey — if booking exists, replay it (200, not 201)
//   2. Check active ban on student
//   3. Read slot + version
//   4. Capacity / cohort-eligibility checks
//   5. prisma.slot.updateMany({ where: { id, version }, data: { version: { increment: 1 } } })
//   6. If count === 0 → another request won the race → retry up to 3 times, then 409
//   7. On success: create Booking + SlotCapacity.current++ + AuditEvent in a transaction

const createBooking = async (req, res, next) => {
  try {
    // TODO Phase 4
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

// Penalty tiers:
//   ≥ 60 min before slot start → no penalty
//   30–59 min before → WARNING (3 warnings auto-convert to 1 STRIKE)
//   < 30 min before  → STRIKE directly
//   After slot start → STRIKE directly (same as no-show path)
const cancelBooking = async (req, res, next) => {
  try {
    // TODO Phase 4
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

// Mentor marks attendance. NO_SHOW → permanent STRIKE → evaluate BanPolicyTier
const markAttendance = async (req, res, next) => {
  try {
    // TODO Phase 4
    res.status(501).json({ error: "Not implemented yet — Phase 4" });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, cancelBooking, markAttendance };
