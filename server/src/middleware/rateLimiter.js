"use strict";

const rateLimit = require("express-rate-limit");

// Applied only to POST /api/bookings — the burst-traffic hotspot.
// 10-second window, 8 requests max per user. Rate-limits per authenticated
// user ID (not IP) so campus NAT / shared egress doesn't block multiple students.
const bookingRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  // req.user is always set — verifySession runs first via router.use(verifySession)
  // Using the user's DB id keeps the limit per-person regardless of shared IPs (campus NAT)
  skipFailedRequests: false,
  keyGenerator: (req) => req.user?.sub ?? "anonymous",
  message: { error: "Too many booking requests — please wait a moment and try again." },
});

module.exports = bookingRateLimiter;
