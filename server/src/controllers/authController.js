"use strict";

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { isViewer } = require("../lib/viewers");

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
      expiresIn: process.env.JWT_EXPIRES_IN || "48h",
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...(whitelistEntry.aig?.slug && { aigSlug: whitelistEntry.aig.slug }),
        ...(whitelistEntry.aig?.category && { aigCategory: whitelistEntry.aig.category }),
        ...(isViewer(user.email) && { canViewAs: true }),
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
    // A view-as session is not a DB user's real session — re-issue the same
    // claims (for as long as the actor is still a viewer) instead of rebuilding
    // them from the target user, which would silently drop the read-only flag.
    if (req.user.viewAs) {
      if (!isViewer(req.user.email)) return res.status(403).json({ error: "Access has been revoked" });
      const { iat, exp, ...claims } = req.user;
      return res.json({
        token: jwt.sign(claims, process.env.JWT_SECRET, {
          algorithm: "HS256",
          expiresIn: process.env.JWT_EXPIRES_IN || "48h",
        }),
      });
    }
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
      expiresIn: process.env.JWT_EXPIRES_IN || "48h",
    });

    res.json({ token });
  } catch (err) {
    next(err);
  }
};

// ─── View-as role switcher (viewers only — see lib/viewers.js) ─────────────────
// Mints a session for another role's board. Everything except MENTOR (the
// viewer's own account) is flagged viewAs and is read-only server-side (see
// middleware/auth.js). `email` stays the viewer's own so the session can keep
// switching; `sub` is the user whose data the board should show.
const VIEW_ROLES = ["STUDENT", "MENTOR", "SuperADMIN", "AIGs", "ACADEMIC_SECY_VIEW"];

const viewAs = async (req, res, next) => {
  try {
    if (!isViewer(req.user.email)) return res.status(403).json({ error: "Forbidden" });

    const { role, aigSlug, pgpId } = req.body ?? {};
    if (!VIEW_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });

    const self = await prisma.user.findUnique({
      where:  { email: req.user.email },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!self) return res.status(404).json({ error: "User not found" });

    let sub = self.id;
    let label = role;
    let aig = null;
    let displayName = self.name;

    if (role === "STUDENT") {
      const id = String(pgpId ?? "").trim();
      if (!id) return res.status(400).json({ error: "pgpId is required for the student view" });
      const sp = await prisma.studentProfile.findUnique({
        where:   { pgpId: id },
        include: { user: { select: { id: true, name: true } } },
      });
      if (!sp) return res.status(404).json({ error: "Student not found" });
      sub = sp.user.id;
      displayName = sp.user.name;
      label = `Student · ${sp.user.name ?? sp.pgpId}`;
    } else if (role === "AIGs") {
      aig = await prisma.aIG.findUnique({ where: { slug: String(aigSlug ?? "") } });
      if (!aig) return res.status(404).json({ error: "AIG not found" });
      label = aig.category === "COMMITTEE" ? `Committee · ${aig.name}` : `AIG · ${aig.name}`;
    } else if (role === "SuperADMIN") {
      label = "Super Admin";
    } else if (role === "ACADEMIC_SECY_VIEW") {
      label = "Academic Secretary";
    } else {
      label = "Mentor";
    }

    const readOnly = role !== "MENTOR";
    const token = jwt.sign(
      {
        sub,
        email: self.email,
        role,
        ...(aig && { aigId: aig.id, aigSlug: aig.slug }),
        ...(readOnly && { viewAs: true, viewLabel: label }),
      },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN || "48h" },
    );

    res.json({
      token,
      user: {
        id: sub,
        email: self.email,
        role,
        name: displayName,
        canViewAs: true,
        ...(readOnly && { viewAs: label }),
        ...(aig && { aigSlug: aig.slug, aigCategory: aig.category }),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Picker data for the switcher: AIGs and a student search by name / PGP ID.
const viewAsOptions = async (req, res, next) => {
  try {
    if (!isViewer(req.user.email)) return res.status(403).json({ error: "Forbidden" });
    const aigs = await prisma.aIG.findMany({
      select:  { slug: true, name: true, category: true },
      orderBy: { name: "asc" },
    });
    res.json({ aigs });
  } catch (err) {
    next(err);
  }
};

const viewAsStudents = async (req, res, next) => {
  try {
    if (!isViewer(req.user.email)) return res.status(403).json({ error: "Forbidden" });
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const students = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { pgpId: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { pgpId: true, user: { select: { name: true } }, cohort: { select: { label: true } } },
      orderBy: { pgpId: "asc" },
      take: 15,
    });
    res.json(students.map((s) => ({ pgpId: s.pgpId, name: s.user?.name ?? "", cohort: s.cohort?.label ?? "" })));
  } catch (err) {
    next(err);
  }
};

module.exports = { googleSignIn, refreshToken, viewAs, viewAsOptions, viewAsStudents };
