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

// Applied to POST /api/auth/google — the only fully public, unauthenticated endpoint.
// Keyed by IP (no req.user exists pre-login). Generous enough for a real user retrying
// a dropped Google popup, tight enough to blunt brute-force/credential-stuffing and DoS.
const authRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — please wait a few minutes and try again." },
});

// Applied to POST /api/auth/refresh — authenticated (verifySession runs first), so this
// is keyed per user rather than per IP.
const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? "anonymous",
  message: { error: "Too many refresh attempts — please wait a moment and try again." },
});

module.exports = { bookingRateLimiter, authRateLimiter, refreshRateLimiter };
