"use strict";

const express = require("express");
const router = express.Router();
const { googleSignIn, refreshToken, viewAs, viewAsOptions, viewAsStudents } = require("../controllers/authController");
const { verifySession, verifySessionAllowViewWrites } = require("../middleware/auth");
const { authRateLimiter, refreshRateLimiter } = require("../middleware/rateLimiter");

// POST /api/auth/google
// Body: { idToken: string }  — Google Identity Services credential
// Response: { token: string, user: { id, email, role, name } }
router.post("/google", authRateLimiter, googleSignIn);

// POST /api/auth/refresh
// Requires: valid Bearer token in Authorization header
// Response: { token: string } — new token with reset expiry
// Called silently by the client when the token is within 60 minutes of expiry.
router.post("/refresh", verifySessionAllowViewWrites, refreshRateLimiter, refreshToken);

// View-as role switcher — only for emails in lib/viewers.js (checked in each handler).
// POST must stay reachable from inside a read-only view-as session, hence AllowViewWrites.
router.post("/view-as", verifySessionAllowViewWrites, viewAs);
router.get("/view-as/options", verifySession, viewAsOptions);
router.get("/view-as/students", verifySession, viewAsStudents);

module.exports = router;
