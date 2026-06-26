"use strict";

const jwt = require("jsonwebtoken");

const verifySession = (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};

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

module.exports = { verifySession, requireRole, requireAigScope };
