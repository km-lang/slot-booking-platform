"use strict";

const prisma = require("../lib/prisma");

// ── Helpers ────────────────────────────────────────────────────────────────────

// Names in these exports come straight from the user's own Google profile —
// fully attacker-controlled. A leading =, +, -, or @ is interpreted as a formula
// by Excel/Sheets/LibreOffice when the CSV is opened, so prefix those with a
// single quote to force text interpretation (standard CSV-injection mitigation).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const escapeCsv = (v) => {
  let s = String(v ?? "");
  if (FORMULA_TRIGGER.test(s)) s = `'${s}`;
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

const row = (cells) => cells.map(escapeCsv).join(",");

const csv = (headers, rows) =>
  [row(headers), ...rows.map((r) => row(r))].join("\n");

// Keeps Content-Disposition filenames free of characters that could break out of the
// quoted header value (defense-in-depth — these inputs are admin/seed-controlled today).
const safeFilenamePart = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "-");

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
      const status   = isBanned ? "Action Needed" : attended.length > 0 ? "Reviewed" : "In Progress";
      const lastDate = attended.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;
      return [u.name ?? "", sp.pgpId, u.email, active.length, attended.length, fmtDate(lastDate), status, isBanned ? "Yes" : "No"];
    });

    const body = csv(headers, dataRows);
    const filename = `cohort-${safeFilenamePart(cohort.label.replace(/\s+/g, "-").toLowerCase())}-${new Date().toISOString().split("T")[0]}.csv`;

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

// ── AIG roster export ───────────────────────────────────────────────────────
// GET /admin/aig/:aigSlug/export  →  CSV of all students within one AIG

const exportAigRoster = async (req, res, next) => {
  try {
    const aig = await prisma.aIG.findUnique({ where: { slug: req.params.aigSlug } });
    if (!aig) return res.status(404).json({ error: "AIG not found" });

    const now = new Date();
    const cohorts = await prisma.cohort.findMany({
      where: { aigId: aig.id },
      include: {
        mentorProfiles: { select: { user: { select: { name: true } } } },
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

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

    const headers = [
      "Name", "PGP ID", "Email", "Cohort", "Mentor",
      "Total Bookings", "Confirmed", "Attended", "No Shows", "Cancelled",
      "Last Session Date", "Status", "Banned",
    ];

    const dataRows = cohorts.flatMap((c) => {
      const mentorName = c.mentorProfiles[0]?.user?.name ?? "Unassigned";
      return c.studentProfiles.map((sp) => {
        const u         = sp.user;
        const bookings  = u.bookings;
        const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
        const attended  = bookings.filter((b) => b.status === "ATTENDED");
        const noShows   = bookings.filter((b) => b.status === "NO_SHOW").length;
        const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;
        const isBanned  = u.bans.length > 0;
        const status    = isBanned ? "Action Needed" : attended.length > 0 ? "Reviewed" : "In Progress";
        const lastDate  = attended.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;

        return [
          u.name ?? "", sp.pgpId, u.email, c.label, mentorName,
          bookings.length, confirmed, attended.length, noShows, cancelled,
          fmtDate(lastDate), status, isBanned ? "Yes" : "No",
        ];
      });
    });

    const body     = csv(headers, dataRows);
    const filename = `aig-${safeFilenamePart(aig.slug)}-roster-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
};

// ── Student's own booking history export ───────────────────────────────────
// GET /bookings/export  →  CSV of the student's own bookings (upcoming + past)

const FOCUS_DISPLAY  = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" };
const STATUS_DISPLAY = { CONFIRMED: "Confirmed", ATTENDED: "Attended", NO_SHOW: "No Show", CANCELLED: "Cancelled" };

const exportMyBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { studentUserId: req.user.sub },
      include: {
        slot: {
          include: {
            mentorProfile: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { slot: { startTime: "desc" } },
    });

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    const fmtTime = (d) =>
      d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "";

    const headers = ["Date", "Time", "Mentor", "Firm", "Domain", "Venue", "Focus", "Status", "Booked On"];
    const dataRows = bookings.map((b) => [
      fmtDate(b.slot.startTime),
      fmtTime(b.slot.startTime),
      b.slot.mentorProfile?.user?.name ?? "—",
      b.slot.mentorProfile?.firm ?? "",
      b.slot.mentorProfile?.domain ?? "",
      b.slot.venue,
      FOCUS_DISPLAY[b.focus] ?? b.focus,
      STATUS_DISPLAY[b.status] ?? b.status,
      fmtDate(b.createdAt),
    ]);

    const body     = csv(headers, dataRows);
    const filename = `my-bookings-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    next(err);
  }
};

module.exports = { exportMentorCohort, exportAdminRoster, exportAigRoster, exportMyBookings };
