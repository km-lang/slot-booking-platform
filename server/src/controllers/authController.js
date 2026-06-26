"use strict";

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Flow: resolve email → check AccessWhitelist → upsert User → sign session JWT
// AUTH_MODE=dev: client sends { email } directly (whitelist still enforced)
// AUTH_MODE=production (default): client sends { idToken } from Google GSI
const googleSignIn = async (req, res, next) => {
  try {
    let email, name;

    // Defense-in-depth: even if AUTH_MODE=dev is left set, never honor the
    // credential-less email-only path on a production deploy — it would let
    // anyone log in as any whitelisted email with zero verification.
    const devModeAllowed = process.env.AUTH_MODE === "dev" && process.env.NODE_ENV !== "production";

    if (devModeAllowed) {
      email = req.body.email?.trim().toLowerCase();
      if (!email) return res.status(400).json({ error: "email is required in dev mode" });
      name = email.split("@")[0];
    } else {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ error: "idToken is required" });

      let ticket;
      try {
        ticket = await googleClient.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch {
        return res.status(401).json({ error: "Invalid Google credential" });
      }
      const payload = ticket.getPayload();
      email = payload?.email;
      name = payload?.name;
      if (!email) return res.status(401).json({ error: "Invalid Google credential" });
    }

    const whitelistEntry = await prisma.accessWhitelist.findUnique({
      where: { email },
      include: { aig: true },
    });
    if (!whitelistEntry) {
      return res.status(403).json({
        error: "This email is not authorised to access Parthsaarthi",
      });
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, role: whitelistEntry.role, name },
      // In dev mode the name is derived from the email prefix — never overwrite a
      // seeded display name with that garbage value. In production the name comes
      // from Google and is always worth keeping fresh.
      update: { role: whitelistEntry.role, ...(!devModeAllowed && name ? { name } : {}) },
    });

    const sessionPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(whitelistEntry.aigId && { aigId: whitelistEntry.aigId }),
      ...(whitelistEntry.aig?.slug && { aigSlug: whitelistEntry.aig.slug }),
    };

    const token = jwt.sign(sessionPayload, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...(whitelistEntry.aig?.slug && { aigSlug: whitelistEntry.aig.slug }),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Silently re-issues a fresh JWT for an already-authenticated user.
// Called by the client when the token is within 60 minutes of expiry.
// Validates the current token (verifySession runs first), re-checks the
// whitelist (catches revoked access), then signs a new token with reset expiry.
const refreshToken = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const whitelistEntry = await prisma.accessWhitelist.findUnique({
      where:   { email: user.email },
      include: { aig: true },
    });
    if (!whitelistEntry) return res.status(403).json({ error: "Access has been revoked" });

    const sessionPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role,
      ...(whitelistEntry.aigId       && { aigId:   whitelistEntry.aigId }),
      ...(whitelistEntry.aig?.slug   && { aigSlug: whitelistEntry.aig.slug }),
    };

    const token = jwt.sign(sessionPayload, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    });

    res.json({ token });
  } catch (err) {
    next(err);
  }
};

module.exports = { googleSignIn, refreshToken };
