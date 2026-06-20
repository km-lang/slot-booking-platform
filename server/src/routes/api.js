"use strict";

const express = require("express");
const router = express.Router();

const { verifySession, requireRole } = require("../middleware/auth");
const bookingRateLimiter = require("../middleware/rateLimiter");

const slotController = require("../controllers/slotController");
const bookingController = require("../controllers/bookingController");
const adminController = require("../controllers/adminController");

// All routes below require a valid session JWT
router.use(verifySession);

// ── AIGs (public-within-auth) ──────────────────────────────────────────────
router.get("/aigs", slotController.listAigs);
router.get("/aigs/:slug", slotController.getAig);

// ── Mentors ────────────────────────────────────────────────────────────────
router.get("/mentors", slotController.listMentors);
router.get("/mentors/:slug", slotController.getMentor);

// ── Slots ──────────────────────────────────────────────────────────────────
// GET  /api/slots?mentorSlug=evelyn-vance   student: list slots (auth-aware: marks bookedByMe)
// POST /api/slots                           mentor: release a new block
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

// ── Bookings ───────────────────────────────────────────────────────────────
// POST   /api/bookings              student: create booking (OCC, idempotency)
// DELETE /api/bookings/:id/release  student: cancel booking (penalty tiers apply)
// POST   /api/bookings/:id/attendance  mentor: mark attended / no-show
router.post("/bookings", bookingRateLimiter, requireRole("STUDENT"), bookingController.createBooking);
router.delete("/bookings/:id/release", requireRole("STUDENT"), bookingController.cancelBooking);
router.post(
  "/bookings/:id/attendance",
  requireRole("MENTOR"),
  bookingController.markAttendance,
);

// ── Cohort (mentor) ────────────────────────────────────────────────────────
router.get("/cohort", requireRole("MENTOR"), slotController.getMentorCohort);

// ── AIG Admin ──────────────────────────────────────────────────────────────
router.get(
  "/admin/aig/:aigSlug",
  requireRole("AIGs"),
  adminController.getAigOverview,
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

module.exports = router;
