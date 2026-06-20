"use strict";

const rateLimit = require("express-rate-limit");

// Applied only to POST /api/bookings — the burst-traffic hotspot.
// 10-second window, 8 requests max. Prevents a student from hammering the
// booking endpoint during a cohort release spike.
const bookingRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many booking requests — please wait a moment and try again." },
});

module.exports = bookingRateLimiter;
