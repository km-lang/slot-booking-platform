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
        mentorProfiles: { select: { id: true, slug: true, user: { select: { name: true } } } },
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
        mentorSlug: c.mentorProfiles[0]?.slug ?? null,
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
    const trendSince = new Date(now.getTime() - 30 * 86400000);

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
      recentBookings,
      cohorts,
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
      // Trend chart source — bucketed by day in JS below (avoids DB-specific date trunc SQL)
      prisma.booking.findMany({
        where: { createdAt: { gte: trendSince } },
        select: { createdAt: true, status: true },
      }),
      // Cohort breakdown — every cohort across every org unit, not just one AIG
      prisma.cohort.findMany({
        include: {
          aig: { select: { name: true, slug: true } },
          studentProfiles: {
            select: { user: { select: { bookings: { select: { status: true } } } } },
          },
        },
        orderBy: [{ aig: { name: "asc" } }, { label: "asc" }],
      }),
    ]);

    const dayKey = (d) => d.toISOString().split("T")[0];
    const trendMap = {};
    for (let i = 0; i < 30; i++) {
      const key = dayKey(new Date(trendSince.getTime() + i * 86400000));
      trendMap[key] = { date: key, created: 0, attended: 0, noShow: 0 };
    }
    for (const b of recentBookings) {
      const key = dayKey(b.createdAt);
      if (!trendMap[key]) continue;
      trendMap[key].created += 1;
      if (b.status === "ATTENDED") trendMap[key].attended += 1;
      if (b.status === "NO_SHOW") trendMap[key].noShow += 1;
    }
    const trends = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

    const cohortBreakdown = cohorts.map((c) => {
      const total = c.studentProfiles.length;
      const covered = c.studentProfiles.filter((sp) =>
        sp.user.bookings.some((b) => b.status === "ATTENDED"),
      ).length;
      return {
        label: c.label,
        orgName: c.aig?.name ?? "—",
        orgSlug: c.aig?.slug ?? null,
        total,
        covered,
        pct: total > 0 ? Math.round((covered / total) * 100) : 0,
      };
    });

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
      trends,
      cohortBreakdown,
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

// ─── Mentor Session Detail (AIG admin view) ───────────────────────────────────

const getMentorSessionDetail = async (req, res, next) => {
  try {
    const { mentorSlug } = req.params;

    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { slug: mentorSlug },
      include: {
        user:   { select: { name: true, email: true } },
        aig:    { select: { slug: true, name: true } },
        cohort: {
          include: {
            studentProfiles: {
              include: {
                user: {
                  select: {
                    name:     true,
                    email:    true,
                    bookings: {
                      where:  { status: { in: ["CONFIRMED", "ATTENDED", "NO_SHOW"] } },
                      select: { id: true, status: true },
                    },
                  },
                },
              },
              orderBy: { pgpId: "asc" },
            },
          },
        },
      },
    });

    if (!mentorProfile) return res.status(404).json({ error: "Mentor not found" });

    // AIG scope check for AIGs role
    if (req.user.role === "AIGs" && mentorProfile.aig?.slug !== req.user.aigSlug) {
      return res.status(403).json({ error: "Forbidden — outside your AIG scope" });
    }

    // All bookings for this mentor's slots
    const bookings = await prisma.booking.findMany({
      where:   { slot: { mentorProfileId: mentorProfile.id } },
      include: {
        slot:    { select: { startTime: true, endTime: true, venue: true } },
        student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const totalSlots  = await prisma.slot.count({ where: { mentorProfileId: mentorProfile.id } });
    const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const stats = {
      totalSlots,
      confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
      attended:  bookings.filter((b) => b.status === "ATTENDED").length,
      noShow:    bookings.filter((b) => b.status === "NO_SHOW").length,
      cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
    };

    // Cohort student list with their cleared status
    const students = (mentorProfile.cohort?.studentProfiles ?? []).map((sp) => {
      const attended = sp.user.bookings.some((b) => b.status === "ATTENDED");
      const booked   = sp.user.bookings.length > 0;
      return {
        name:     sp.user.name ?? sp.user.email,
        email:    sp.user.email,
        pgpId:    sp.pgpId,
        status:   attended ? "Attended" : booked ? "Booked" : "Pending",
      };
    });

    const sessionHistory = bookings.map((b) => ({
      id:          b.id,
      status:      b.status,
      focus:       FOCUS_DISPLAY[b.focus] ?? b.focus,
      date:        fmtDate(b.slot.startTime),
      time:        fmtTime(b.slot.startTime),
      venue:       b.slot.venue,
      studentName: b.student?.name ?? "—",
      studentPgp:  b.student?.studentProfile?.pgpId ?? "—",
      studentEmail:b.student?.email ?? "—",
      createdAt:   b.createdAt,
    }));

    res.json({
      mentor: {
        name:   mentorProfile.user.name,
        email:  mentorProfile.user.email,
        firm:   mentorProfile.firm,
        domain: mentorProfile.domain,
        slug:   mentorProfile.slug,
      },
      aig:          mentorProfile.aig ? { slug: mentorProfile.aig.slug, name: mentorProfile.aig.name } : null,
      cohortLabel:  mentorProfile.cohort?.label ?? null,
      stats,
      students,
      sessionHistory,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Org & Mentor Stats (SuperADMIN) ──────────────────────────────────────────

const getOrgStats = async (_req, res, next) => {
  try {
    const orgUnits = await prisma.aIG.findMany({
      include: { mentorProfiles: { include: { _count: { select: { slots: true } } } } },
      orderBy: { name: "asc" },
    });

    const statsFor = async (mentorProfiles) => {
      const mentorIds = mentorProfiles.map((m) => m.id);
      const slotsOffered = mentorProfiles.reduce((sum, m) => sum + m._count.slots, 0);
      const completed = mentorIds.length
        ? await prisma.booking.count({
            where: { slot: { mentorProfileId: { in: mentorIds } }, status: { in: ["CONFIRMED", "ATTENDED"] } },
          })
        : 0;
      return {
        mentorCount: mentorProfiles.length,
        slotsOffered,
        completed,
        utilizationPct: slotsOffered > 0 ? Math.round((completed / slotsOffered) * 100) : 0,
      };
    };

    let disha = null;
    const aigs = [];
    const committeeAgg = [];
    const clubAgg = [];
    const aigAgg = [];

    for (const org of orgUnits) {
      const stats = await statsFor(org.mentorProfiles);
      const row = { slug: org.slug, name: org.name, category: org.category, ...stats };
      if (org.slug === "disha") disha = row;
      if (org.category === "AIG") aigs.push(row);
      if (org.category === "COMMITTEE") committeeAgg.push(stats);
      if (org.category === "CLUB") clubAgg.push(stats);
      if (org.category === "AIG") aigAgg.push(stats);
    }

    const nonAigMentors = await prisma.mentorProfile.findMany({
      where: { aigId: null },
      include: { _count: { select: { slots: true } } },
    });
    const nonAig = await statsFor(nonAigMentors);

    const sumAgg = (rows) =>
      rows.reduce(
        (acc, r) => ({
          mentorCount: acc.mentorCount + r.mentorCount,
          slotsOffered: acc.slotsOffered + r.slotsOffered,
          completed: acc.completed + r.completed,
        }),
        { mentorCount: 0, slotsOffered: 0, completed: 0 },
      );
    const withPct = (agg) => ({
      ...agg,
      utilizationPct: agg.slotsOffered > 0 ? Math.round((agg.completed / agg.slotsOffered) * 100) : 0,
    });

    res.json({
      disha,
      aigs,
      nonAig,
      rollup: {
        committee: withPct(sumAgg(committeeAgg)),
        club: withPct(sumAgg(clubAgg)),
        aig: withPct(sumAgg(aigAgg)),
      },
    });
  } catch (err) {
    next(err);
  }
};

const listMentorStats = async (_req, res, next) => {
  try {
    const [mentors, allBookings] = await Promise.all([
      prisma.mentorProfile.findMany({
        include: {
          user: { select: { name: true, email: true } },
          aig: { select: { slug: true, name: true } },
          _count: { select: { slots: true } },
        },
        orderBy: { user: { name: "asc" } },
      }),
      // One query for every mentor's booking counts instead of N+1 per-mentor queries.
      prisma.booking.findMany({
        select: { status: true, slot: { select: { mentorProfileId: true } } },
      }),
    ]);

    const statsByMentor = {};
    for (const b of allBookings) {
      const mid = b.slot.mentorProfileId;
      const s = statsByMentor[mid] ?? (statsByMentor[mid] = { completed: 0, attended: 0, noShow: 0, cancelled: 0 });
      if (b.status === "CONFIRMED" || b.status === "ATTENDED") s.completed += 1;
      if (b.status === "ATTENDED") s.attended += 1;
      if (b.status === "NO_SHOW") s.noShow += 1;
      if (b.status === "CANCELLED") s.cancelled += 1;
    }

    const rows = mentors.map((m) => {
      const s = statsByMentor[m.id] ?? { completed: 0, attended: 0, noShow: 0, cancelled: 0 };
      const slotsOffered = m._count.slots;
      const category = !m.aig ? "non-aig" : m.aig.slug === "disha" ? "disha" : m.aig.slug;
      return {
        slug: m.slug,
        name: m.user.name ?? m.user.email,
        email: m.user.email,
        firm: m.firm,
        domain: m.domain,
        mentorType: m.mentorType,
        category,
        orgName: m.aig?.name ?? "Independent (No AIG)",
        slotsOffered,
        ...s,
        utilizationPct: slotsOffered > 0 ? Math.round((s.completed / slotsOffered) * 100) : 0,
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ─── Student/Mentee History (SuperADMIN) ──────────────────────────────────────

const searchStudents = async (req, res, next) => {
  try {
    const q = (req.query.q ?? "").trim();
    if (!q) return res.json([]);

    const students = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { pgpId: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { user: { select: { name: true, email: true } }, cohort: { select: { label: true } } },
      take: 20,
    });

    res.json(
      students.map((sp) => ({
        pgpId: sp.pgpId,
        name: sp.user.name ?? sp.user.email,
        email: sp.user.email,
        cohortLabel: sp.cohort?.label ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
};

const getStudentDetail = async (req, res, next) => {
  try {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { pgpId: req.params.pgpId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        cohort: { select: { label: true, aig: { select: { name: true, slug: true } } } },
      },
    });
    if (!studentProfile) return res.status(404).json({ error: "Student not found" });

    const [bookings, bans] = await Promise.all([
      prisma.booking.findMany({
        where: { studentUserId: studentProfile.user.id },
        include: {
          slot: { include: { mentorProfile: { include: { user: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ban.findMany({
        where: { userId: studentProfile.user.id },
        orderBy: { startsAt: "desc" },
      }),
    ]);

    const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    res.json({
      student: {
        name: studentProfile.user.name ?? studentProfile.user.email,
        email: studentProfile.user.email,
        pgpId: studentProfile.pgpId,
        cohortLabel: studentProfile.cohort?.label ?? null,
        orgName: studentProfile.cohort?.aig?.name ?? null,
      },
      stats: {
        totalBookings: bookings.length,
        confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
        attended: bookings.filter((b) => b.status === "ATTENDED").length,
        noShow: bookings.filter((b) => b.status === "NO_SHOW").length,
        cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
      },
      bookingHistory: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        focus: FOCUS_DISPLAY[b.focus] ?? b.focus,
        date: fmtDate(b.slot.startTime),
        time: fmtTime(b.slot.startTime),
        venue: b.slot.venue,
        mentorName: b.slot.mentorProfile?.user?.name ?? "—",
      })),
      bans: bans.map((b) => ({
        reason: b.reason,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        liftedAt: b.liftedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAigOverview,
  getMentorSessionDetail,
  getBatchOverview,
  listWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  getConfig,
  setConfig,
  listBans,
  liftBan,
  getOrgStats,
  listMentorStats,
  searchStudents,
  getStudentDetail,
};
