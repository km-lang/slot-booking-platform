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

    if (process.env.AUTH_MODE === "dev") {
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
      update: { role: whitelistEntry.role, ...(name && { name }) },
    });

    const sessionPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(whitelistEntry.aigId && { aigId: whitelistEntry.aigId }),
      ...(whitelistEntry.aig?.slug && { aigSlug: whitelistEntry.aig.slug }),
    };

    const token = jwt.sign(sessionPayload, process.env.JWT_SECRET, {
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

module.exports = { googleSignIn };
