"use strict";

const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Sessions minted by POST /auth/view-as carry viewAs: true and are strictly
// read-only — every non-GET request is refused, so a viewer browsing another
// role's board can never change data. Routes that must stay writable for such
// a session (token refresh, switching view) use verifySessionAllowViewWrites.
const checkSession = ({ blockViewWrites }) => (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  if (blockViewWrites && req.user.viewAs && !SAFE_METHODS.has(req.method)) {
    return res.status(403).json({ error: "View-only mode — switch back to your own account to make changes" });
  }
  next();
};

const verifySession = checkSession({ blockViewWrites: true });
const verifySessionAllowViewWrites = checkSession({ blockViewWrites: false });

const requireRole = (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden — insufficient role" });
    }
    next();
  };

const requireAigScope = (slugParam) =>
  (req, res, next) => {
    if (!req.user || req.user.aigSlug !== req.params[slugParam]) {
      return res.status(403).json({ error: "Forbidden — outside your AIG scope" });
    }
    next();
  };

// Like requireAigScope, but for routes keyed by a mentor's slug rather than an
// AIG's — the AIG to scope against has to be resolved from the mentor first.
// SuperADMIN bypasses (no AIG scope applies to that role); a mentor with no AIG
// (independent mentor) is out of scope for every AIGs-role user by construction.
const requireMentorAigScope = (mentorSlugParam) =>
  async (req, res, next) => {
    if (!req.user) return res.status(403).json({ error: "Forbidden" });
    if (req.user.role !== "AIGs") return next();

    try {
      const mentor = await prisma.mentorProfile.findUnique({
        where:  { slug: req.params[mentorSlugParam] },
        select: { aig: { select: { slug: true } } },
      });
      // Let a nonexistent mentor fall through to the route's own 404, rather
      // than masking it behind a 403.
      if (!mentor) return next();
      if (mentor.aig?.slug !== req.user.aigSlug) {
        return res.status(403).json({ error: "Forbidden — outside your AIG scope" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };

module.exports = { verifySession, verifySessionAllowViewWrites, requireRole, requireAigScope, requireMentorAigScope };
