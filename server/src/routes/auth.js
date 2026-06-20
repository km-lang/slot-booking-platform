"use strict";

const express = require("express");
const router = express.Router();
const { googleSignIn } = require("../controllers/authController");

// POST /api/auth/google
// Body: { idToken: string }  — Google Identity Services credential
// Response: { token: string, user: { id, email, role, name } }
router.post("/google", googleSignIn);

module.exports = router;
