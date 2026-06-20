"use strict";

// Phase 2 stub — full implementation (JWT verify + requireRole + requireAigScope) in Phase 3.

const verifySession = (req, _res, next) => {
  // TODO Phase 3: verify our JWT, attach req.user = { id, email, role, aigId? }
  next();
};

const requireRole = (...roles) =>
  (req, res, next) => {
    // TODO Phase 3: check req.user.role against roles array, return 403 if mismatch
    next();
  };

const requireAigScope = (slugParam) =>
  (req, res, next) => {
    // TODO Phase 3: verify req.user.aigSlug === req.params[slugParam]
    next();
  };

module.exports = { verifySession, requireRole, requireAigScope };
