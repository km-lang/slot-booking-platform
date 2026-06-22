"use strict";

const prisma = require("../lib/prisma");

// ── Helpers ────────────────────────────────────────────────────────────────────

const escapeCsv = (v) => {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const row = (cells) => cells.map(escapeCsv).join(",");

const csv = (headers, rows) =>
  [row(headers), ...rows.map((r) => row(r))].join("\n");

// ── Mentor cohort export ───────────────────────────────────────────────────────
// GET /cohort/export  →  CSV of the mentor's cohort members

const exportMentorCohort = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile" });
    if (!mentorProfile.cohortId) return res.status(404).json({ error: "No cohort assigned" });

    const now = new Date();
    const cohort = await prisma.cohort.findUnique({
      where: { id: mentorProfile.cohortId },
      include: {
        studentProfiles: {
          include: {
            user: {
              include: {
                bookings: true,
                bans: {
                  where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                },
              },
            },
          },
        },
      },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

    const headers = ["Name", "PGP ID", "Email", "Slots Taken", "Sessions Attended", "Last Review Date", "Status", "Banned"];
    const dataRows = cohort.studentProfiles.map((sp) => {
      const u        = sp.user;
      const attended = u.bookings.filter((b) => b.status === "ATTENDED");
      const active   = u.bookings.filter((b) => b.status !== "CANCELLED");
      const isBanned = u.bans.length > 0;
      const status   = isBanned ? "Action Needed" : attended.length > 0 ? "Ready" : "In Progress";
      const lastDate = attended.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;
      return [u.name ?? "", sp.pgpId, u.email, active.length, attended.length, fmtDate(lastDate), status, isBanned ? "Yes" : "No"];
    });

    const body = csv(headers, dataRows);
    const filename = `cohort-${cohort.label.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
};

// ── Admin full roster export ───────────────────────────────────────────────────
// GET /admin/export/roster  →  CSV of all students batch-wide

const exportAdminRoster = async (req, res, next) => {
  try {
    const now = new Date();
    const students = await prisma.studentProfile.findMany({
      include: {
        user: {
          include: {
            bookings: true,
            bans: {
              where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            },
          },
        },
        cohort: {
          include: { aig: { select: { name: true } } },
        },
      },
      orderBy: { pgpId: "asc" },
    });

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

    const headers = [
      "Name", "PGP ID", "Email",
      "AIG", "Cohort",
      "Total Bookings", "Confirmed", "Attended", "No Shows", "Cancelled",
      "Last Session Date",
      "Ban Status",
    ];

    const dataRows = students.map((sp) => {
      const u          = sp.user;
      const bookings   = u.bookings;
      const confirmed  = bookings.filter((b) => b.status === "CONFIRMED").length;
      const attended   = bookings.filter((b) => b.status === "ATTENDED");
      const noShows    = bookings.filter((b) => b.status === "NO_SHOW").length;
      const cancelled  = bookings.filter((b) => b.status === "CANCELLED").length;
      const isBanned   = u.bans.length > 0;
      const lastDate   = attended.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;

      return [
        u.name ?? "", sp.pgpId, u.email,
        sp.cohort?.aig?.name ?? "", sp.cohort?.label ?? "",
        bookings.length, confirmed, attended.length, noShows, cancelled,
        fmtDate(lastDate),
        isBanned ? "Banned" : "Active",
      ];
    });

    const body     = csv(headers, dataRows);
    const filename = `batch-roster-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
};

module.exports = { exportMentorCohort, exportAdminRoster };
