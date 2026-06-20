"use strict";

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Flow: verify Google id_token → check AccessWhitelist → upsert User → issue session JWT
const googleSignIn = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "idToken is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email;
    if (!email) {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    const whitelistEntry = await prisma.accessWhitelist.findUnique({
      where: { email },
      include: { aig: true },
    });
    if (!whitelistEntry) {
      return res.status(403).json({ error: "This email is not authorised to access Parthsaarthi" });
    }

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, role: whitelistEntry.role, name: payload.name },
      update: { role: whitelistEntry.role, name: payload.name },
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
    if (err.message?.includes("Token used too late") || err.message?.includes("Wrong number of segments")) {
      return res.status(401).json({ error: "Invalid Google credential" });
    }
    next(err);
  }
};

module.exports = { googleSignIn };
