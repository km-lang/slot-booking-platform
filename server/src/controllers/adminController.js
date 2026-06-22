"use strict";

const prisma = require("../lib/prisma");

const FOCUS_DISPLAY = { overall: "Overall CV", workex: "Work Experience", por: "POR / ECA" };

// ─── AIG Admin ───────────────────────────────────────────────────────────────

const getAigOverview = async (req, res, next) => {
  try {
    const aig = await prisma.aIG.findUnique({ where: { slug: req.params.aigSlug } });
    if (!aig) return res.status(404).json({ error: "AIG not found" });

    const cvFreeze = await prisma.systemConfig.findUnique({ where: { key: "cv_freeze_deadline" } });
    const cvFreezeDeadline = cvFreeze?.value ?? null;
    const now = new Date();
    const daysRemaining = cvFreezeDeadline
      ? Math.max(0, Math.ceil((new Date(cvFreezeDeadline) - now) / 86400000))
      : null;

    const cohorts = await prisma.cohort.findMany({
      where: { aigId: aig.id },
      include: {
        mentorProfiles: { include: { user: { select: { name: true } } } },
        studentProfiles: {
          include: {
            user: {
              include: {
                bookings: { where: { status: { in: ["CONFIRMED", "ATTENDED"] } } },
                bans: {
                  where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                },
              },
            },
          },
        },
      },
    });

    // Batch-level readiness (students with ≥1 ATTENDED booking)
    const allStudents = cohorts.flatMap((c) => c.studentProfiles);
    const totalStudents = allStudents.length;
    const clearedStudents = allStudents.filter((sp) =>
      sp.user.bookings.some((b) => b.status === "ATTENDED")
    ).length;
    const readinessPct =
      totalStudents > 0 ? Math.round((clearedStudents / totalStudents) * 100) : 0;

    // Per-cohort stats
    const cohortData = cohorts.map((c) => {
      const total = c.studentProfiles.length;
      const reviewed = c.studentProfiles.filter((sp) =>
        sp.user.bookings.some((b) => b.status === "ATTENDED")
      ).length;
      let status = "On Track";
      if (total > 0 && reviewed === total) status = "Completed";
      else if (total > 0 && total - reviewed > total / 2) status = "Critical";
      return {
        id: c.id,
        label: c.label,
        mentorName: c.mentorProfiles[0]?.user?.name ?? "Unassigned",
        total,
        reviewed,
        pending: total - reviewed,
        status,
      };
    });

    // At-risk: zero bookings OR active ban
    const atRisk = [];
    for (const cohort of cohorts) {
      for (const sp of cohort.studentProfiles) {
        const hasBooking = sp.user.bookings.length > 0;
        const isBanned = sp.user.bans.length > 0;
        if (!hasBooking || isBanned) {
          atRisk.push({
            name: sp.user.name ?? sp.user.email,
            pgp: sp.pgpId,
            email: sp.user.email,
            cohortLabel: cohort.label,
            reason: isBanned ? "Active Ban" : "Zero Bookings",
            daysRemaining,
          });
        }
      }
    }

    res.json({
      aigName: aig.name,
      cvFreezeDeadline,
      batchReadiness: { pct: readinessPct, cleared: clearedStudents, total: totalStudents },
      cohorts: cohortData,
      atRiskStudents: atRisk,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Placement Admin ──────────────────────────────────────────────────────────

const getBatchOverview = async (_req, res, next) => {
  try {
    const now = new Date();

    const [
      totalStudents,
      coveredStudents,
      totalSlots,
      noShowCount,
      totalUtilized,
      activeBans,
      purposeDist,
      mentors,
      recentAudit,
    ] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.studentProfile.count({
        where: { user: { bookings: { some: { status: "ATTENDED" } } } },
      }),
      prisma.slot.count(),
      prisma.booking.count({ where: { status: "NO_SHOW" } }),
      prisma.booking.count({ where: { status: { in: ["CONFIRMED", "ATTENDED"] } } }),
      prisma.ban.count({
        where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      }),
      prisma.booking.groupBy({ by: ["focus"], _count: { _all: true } }),
      prisma.mentorProfile.findMany({
        take: 8,
        include: { user: { select: { name: true } }, _count: { select: { slots: true } } },
        orderBy: { slots: { _count: "desc" } },
      }),
      prisma.auditEvent.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, role: true } } },
      }),
    ]);

    const coveragePct =
      totalStudents > 0 ? Math.round((coveredStudents / totalStudents) * 100) : 0;
    const slotsPct = totalSlots > 0 ? Math.round((totalUtilized / totalSlots) * 100) : 0;
    const noShowPct =
      totalUtilized > 0 ? +((noShowCount / totalUtilized) * 100).toFixed(1) : 0;

    // Per-mentor completion counts (N+1 acceptable at take:8 scale)
    const mentorUtil = (
      await Promise.all(
        mentors.map(async (m) => {
          const completed = await prisma.booking.count({
            where: {
              slot: { mentorProfileId: m.id },
              status: { in: ["CONFIRMED", "ATTENDED"] },
            },
          });
          return { name: m.user.name?.split(" ")[0] ?? "—", offered: m._count.slots, completed };
        })
      )
    ).filter((m) => m.offered > 0);

    res.json({
      kpis: {
        batchCoverage: { pct: coveragePct, covered: coveredStudents, total: totalStudents },
        slotsUtilized: { count: totalUtilized, total: totalSlots, pct: slotsPct },
        noShowRate: { pct: noShowPct, count: noShowCount },
        activeBans,
      },
      purposeDistribution: purposeDist.map((p) => ({
        name: FOCUS_DISPLAY[p.focus] ?? p.focus,
        value: p._count._all,
      })),
      mentorUtilization: mentorUtil,
      recentAuditEvents: recentAudit.map((e) => ({
        id: e.id,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        meta: e.meta,
        createdAt: e.createdAt,
        userEmail: e.user?.email ?? "system",
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Whitelist ────────────────────────────────────────────────────────────────

const listWhitelist = async (_req, res, next) => {
  try {
    const list = await prisma.accessWhitelist.findMany({
      include: { aig: { select: { name: true, slug: true } } },
      orderBy: { email: "asc" },
    });
    res.json(
      list.map((w) => ({
        id: w.id,
        email: w.email,
        role: w.role,
        aigName: w.aig?.name ?? null,
        aigSlug: w.aig?.slug ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
};

const addToWhitelist = async (req, res, next) => {
  try {
    const { email, role, aigSlug } = req.body;
    if (!email || !role) return res.status(400).json({ error: "email and role are required" });
    if (!["STUDENT", "MENTOR", "AIGs", "SuperADMIN"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    let aigId = null;
    if (role === "AIGs") {
      if (!aigSlug) return res.status(400).json({ error: "aigSlug is required for AIGs role" });
      const aig = await prisma.aIG.findUnique({ where: { slug: aigSlug } });
      if (!aig) return res.status(400).json({ error: `AIG '${aigSlug}' not found` });
      aigId = aig.id;
    }

    const entry = await prisma.accessWhitelist.create({
      data: { email: email.trim().toLowerCase(), role, aigId, addedBy: req.user.email },
      include: { aig: { select: { name: true, slug: true } } },
    });
    res.status(201).json({
      id: entry.id,
      email: entry.email,
      role: entry.role,
      aigName: entry.aig?.name ?? null,
      aigSlug: entry.aig?.slug ?? null,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "This email is already on the whitelist" });
    }
    next(err);
  }
};

const removeFromWhitelist = async (req, res, next) => {
  try {
    const entry = await prisma.accessWhitelist.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: "Entry not found" });

    const requestingUser = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (entry.email === requestingUser?.email) {
      return res.status(409).json({ error: "Cannot remove your own access entry" });
    }

    await prisma.accessWhitelist.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
};

// ─── System Config ────────────────────────────────────────────────────────────

const getConfig = async (_req, res, next) => {
  try {
    const rows = await prisma.systemConfig.findMany();
    const result = {};
    for (const r of rows) result[r.key] = r.value;
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const setConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value is required" });
    const row = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    res.json({ key: row.key, value: row.value });
  } catch (err) {
    next(err);
  }
};

// ─── Ban Management ───────────────────────────────────────────────────────────

const listBans = async (_req, res, next) => {
  try {
    const now = new Date();
    const bans = await prisma.ban.findMany({
      where: {
        liftedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { startsAt: "desc" },
    });
    res.json(
      bans.map((b) => ({
        id: b.id,
        userId: b.userId,
        userName: b.user.name ?? b.user.email,
        userEmail: b.user.email,
        reason: b.reason,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

const liftBan = async (req, res, next) => {
  try {
    const ban = await prisma.ban.findUnique({ where: { id: req.params.id } });
    if (!ban) return res.status(404).json({ error: "Ban not found" });
    if (ban.liftedAt) return res.status(409).json({ error: "Ban already lifted" });

    const lifted = await prisma.ban.update({
      where: { id: req.params.id },
      data: { liftedAt: new Date(), liftedBy: req.user.email },
    });

    await prisma.auditEvent.create({
      data: {
        userId: req.user.sub,
        action: "BAN_LIFTED",
        entity: "Ban",
        entityId: ban.id,
        meta: JSON.stringify({ bannedUserId: ban.userId }),
      },
    });

    res.json({ lifted: true, liftedAt: lifted.liftedAt });
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
  listBans,
  liftBan,
};
