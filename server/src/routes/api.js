"use strict";

const express = require("express");
const router = express.Router();

const { verifySession, requireRole, requireAigScope } = require("../middleware/auth");
const bookingRateLimiter = require("../middleware/rateLimiter");

const slotController    = require("../controllers/slotController");
const bookingController = require("../controllers/bookingController");
const adminController   = require("../controllers/adminController");
const exportController  = require("../controllers/exportController");
const profileController = require("../controllers/profileController");

// All routes below require a valid session JWT
router.use(verifySession);

// ── Profile ────────────────────────────────────────────────────────────────
router.get("/profile",   profileController.getProfile);
router.patch("/profile", profileController.updateProfile);

// ── AIGs (public-within-auth) ──────────────────────────────────────────────
router.get("/aigs", slotController.listAigs);
router.get("/aigs/:slug", slotController.getAig);

// ── Mentors ────────────────────────────────────────────────────────────────
router.get("/mentors", slotController.listMentors);
router.get("/mentors/:slug", slotController.getMentor);

// ── Slots ──────────────────────────────────────────────────────────────────
// GET  /api/slots/mine                      mentor: own dashboard data (today's sessions + available slots)
// GET  /api/slots?mentorSlug=evelyn-vance   student: list slots (auth-aware: marks bookedByMe)
// POST /api/slots                           mentor: release a new block
router.get("/slots/mine", requireRole("MENTOR"), slotController.listMentorOwnSlots);
router.get("/slots", slotController.listSlots);
router.post(
  "/slots",
  requireRole("MENTOR"),
  slotController.releaseSlots,
);
router.delete(
  "/slots/:id",
  requireRole("MENTOR"),
  slotController.deleteSlot,
);
router.patch(
  "/slots/:id/delay",
  requireRole("MENTOR"),
  slotController.setSlotDelay,
);

// ── Bookings ───────────────────────────────────────────────────────────────
// GET    /api/bookings/mine         student: own booking history (upcoming + past)
// POST   /api/bookings              student: create booking (OCC, idempotency)
// DELETE /api/bookings/:id/release  student: cancel booking (penalty tiers apply)
// POST   /api/bookings/:id/attendance  mentor: mark attended / no-show
router.get("/bookings/mine", requireRole("STUDENT"), bookingController.getMyBookings);
router.post("/bookings", bookingRateLimiter, requireRole("STUDENT"), bookingController.createBooking);
router.delete("/bookings/:id/release", requireRole("STUDENT"), bookingController.cancelBooking);
router.post(
  "/bookings/:id/attendance",
  requireRole("MENTOR"),
  bookingController.markAttendance,
);

// ── Cohort (mentor) ────────────────────────────────────────────────────────
router.get("/cohort",        requireRole("MENTOR"), slotController.getMentorCohort);
router.get("/cohort/export", requireRole("MENTOR"), exportController.exportMentorCohort);

// ── AIG Admin ──────────────────────────────────────────────────────────────
router.get(
  "/admin/aig/:aigSlug",
  requireRole("AIGs"),
  requireAigScope("aigSlug"),
  adminController.getAigOverview,
);
router.get(
  "/admin/mentor/:mentorSlug",
  requireRole("AIGs", "SuperADMIN"),
  adminController.getMentorSessionDetail,
);

// ── Placement Admin (SuperADMIN only) ─────────────────────────────────────
router.get(
  "/admin/batch",
  requireRole("SuperADMIN"),
  adminController.getBatchOverview,
);
router.get(
  "/admin/whitelist",
  requireRole("SuperADMIN"),
  adminController.listWhitelist,
);
router.post(
  "/admin/whitelist",
  requireRole("SuperADMIN"),
  adminController.addToWhitelist,
);
router.delete(
  "/admin/whitelist/:id",
  requireRole("SuperADMIN"),
  adminController.removeFromWhitelist,
);

// ── System Config (SuperADMIN only) ───────────────────────────────────────
router.get("/admin/config", requireRole("SuperADMIN"), adminController.getConfig);
router.put("/admin/config/:key", requireRole("SuperADMIN"), adminController.setConfig);

// ── Ban Management (SuperADMIN only) ──────────────────────────────────────
router.get("/admin/bans",          requireRole("SuperADMIN"), adminController.listBans);
router.patch("/admin/bans/:id/lift", requireRole("SuperADMIN"), adminController.liftBan);

// ── Data Export ────────────────────────────────────────────────────────────
router.get("/admin/export/roster", requireRole("SuperADMIN"), exportController.exportAdminRoster);

module.exports = router;
