"use strict";

const express = require("express");
const router = express.Router();
const { googleSignIn, refreshToken } = require("../controllers/authController");
const { verifySession } = require("../middleware/auth");
const { authRateLimiter, refreshRateLimiter } = require("../middleware/rateLimiter");

// POST /api/auth/google
// Body: { idToken: string }  — Google Identity Services credential
// Response: { token: string, user: { id, email, role, name } }
router.post("/google", authRateLimiter, googleSignIn);

// POST /api/auth/refresh
// Requires: valid Bearer token in Authorization header
// Response: { token: string } — new token with reset expiry
// Called silently by the client when the token is within 60 minutes of expiry.
router.post("/refresh", verifySession, refreshRateLimiter, refreshToken);

module.exports = router;
