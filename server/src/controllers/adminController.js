"use strict";

// Phase 2 stub — full implementation in Phase 6.

const getAigOverview = async (req, res, next) => {
  try {
    // TODO Phase 6: return cohorts, atRiskStudents, batchReadiness % scoped to req.params.aigSlug
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const getBatchOverview = async (_req, res, next) => {
  try {
    // TODO Phase 6: aggregate KPIs across all AIGs for PlacementAdminDashboard
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const listWhitelist = async (_req, res, next) => {
  try {
    // TODO Phase 6: prisma.accessWhitelist.findMany({ include: { aig: true } })
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const addToWhitelist = async (req, res, next) => {
  try {
    // TODO Phase 6: validate email + role + optional aigId, then prisma.accessWhitelist.create()
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const removeFromWhitelist = async (req, res, next) => {
  try {
    // TODO Phase 6: cannot remove own SuperADMIN row; prisma.accessWhitelist.delete()
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const getConfig = async (_req, res, next) => {
  try {
    // TODO Phase 6: prisma.systemConfig.findMany()
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

const setConfig = async (req, res, next) => {
  try {
    // TODO Phase 6: prisma.systemConfig.upsert({ where: { key }, update/create: { value } })
    res.status(501).json({ error: "Not implemented yet — Phase 6" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAigOverview,
  getBatchOverview,
  listWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  getConfig,
  setConfig,
};
