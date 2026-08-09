"use strict";

const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { cohortMemberWhere } = require("../lib/cohortMembership");

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

const respondCsv = (res, { body, filename }) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
};

// ── CSV builders ─────────────────────────────────────────────────────────────
// Pure data-fetch-and-format functions, reused by both the direct authenticated
// route (desktop browsers, where a blob download works fine) and the
// token-download route (see downloadWithToken below — needed for in-app
// browsers like WhatsApp/Instagram that don't honor a JS-triggered blob
// download, but do respect a real navigation's Content-Disposition header).

const buildMentorCohortCsv = async (mentorUserId) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: mentorUserId } });
  if (!mentorProfile) return { status: 403, error: "No mentor profile" };
  if (!mentorProfile.cohortId) return { status: 404, error: "No cohort assigned" };

  const now = new Date();
  const cohort = await prisma.cohort.findUnique({ where: { id: mentorProfile.cohortId } });
  if (!cohort) return { status: 404, error: "Cohort not found" };

  const studentProfiles = await prisma.studentProfile.findMany({
    where: cohortMemberWhere(mentorProfile.cohortId),
    include: {
      user: {
        include: {
          bookings: true,
          bans: { where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } },
        },
      },
    },
  });

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

  const headers = ["Name", "PGP ID", "Email", "Slots Taken", "Sessions Attended", "Last Review Date", "Status", "Banned"];
  const dataRows = studentProfiles.map((sp) => {
    const u        = sp.user;
    const attended = u.bookings.filter((b) => b.status === "ATTENDED");
    const active   = u.bookings.filter((b) => b.status !== "CANCELLED");
    const isBanned = u.bans.length > 0;
    const status   = isBanned ? "Action Needed" : attended.length > 0 ? "Reviewed" : "In Progress";
    const lastDate = attended.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;
    return [u.name ?? "", sp.pgpId, u.email, active.length, attended.length, fmtDate(lastDate), status, isBanned ? "Yes" : "No"];
  });

  return {
    body: csv(headers, dataRows),
    filename: `cohort-${safeFilenamePart(cohort.label.replace(/\s+/g, "-").toLowerCase())}-${new Date().toISOString().split("T")[0]}.csv`,
  };
};

const buildAdminRosterCsv = async () => {
  const now = new Date();
  const students = await prisma.studentProfile.findMany({
    include: {
      user: {
        include: {
          bookings: true,
          bans: { where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } },
        },
      },
      cohort: { include: { aig: { select: { name: true } } } },
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

  return { body: csv(headers, dataRows), filename: `batch-roster-${new Date().toISOString().split("T")[0]}.csv` };
};

const buildAigRosterCsv = async (aigSlug) => {
  const aig = await prisma.aIG.findUnique({ where: { slug: aigSlug } });
  if (!aig) return { status: 404, error: "AIG not found" };

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
              bans: { where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } },
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

  return {
    body: csv(headers, dataRows),
    filename: `aig-${safeFilenamePart(aig.slug)}-roster-${new Date().toISOString().split("T")[0]}.csv`,
  };
};

const FOCUS_DISPLAY  = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA", cv_hr: "CV-HR" };
const STATUS_DISPLAY = { CONFIRMED: "Confirmed", ATTENDED: "Attended", NO_SHOW: "No Show", CANCELLED: "Cancelled" };

const buildMyBookingsCsv = async (studentUserId) => {
  const bookings = await prisma.booking.findMany({
    where: { studentUserId },
    include: { slot: { include: { mentorProfile: { include: { user: { select: { name: true } } } } } } },
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

  return { body: csv(headers, dataRows), filename: `my-bookings-${new Date().toISOString().split("T")[0]}.csv` };
};

// ── Direct authenticated routes (existing behavior, unchanged) ────────────────

const exportMentorCohort = async (req, res, next) => {
  try {
    const result = await buildMentorCohortCsv(req.user.sub);
    if (result.error) return res.status(result.status).json({ error: result.error });
    respondCsv(res, result);
  } catch (err) { next(err); }
};

const exportAdminRoster = async (_req, res, next) => {
  try {
    respondCsv(res, await buildAdminRosterCsv());
  } catch (err) { next(err); }
};

const exportAigRoster = async (req, res, next) => {
  try {
    const result = await buildAigRosterCsv(req.params.aigSlug);
    if (result.error) return res.status(result.status).json({ error: result.error });
    respondCsv(res, result);
  } catch (err) { next(err); }
};

const exportMyBookings = async (req, res, next) => {
  try {
    respondCsv(res, await buildMyBookingsCsv(req.user.sub));
  } catch (err) { next(err); }
};

// ── Token-based download (in-app-browser-safe) ─────────────────────────────────
// A JS-triggered blob download (URL.createObjectURL + a[download].click(), see
// client's apiClient.js downloadFile()) is known to silently fail in several
// mobile in-app browsers (WhatsApp, Instagram, LinkedIn webviews) — they either
// ignore the download attribute and open the blob in a viewer, or do nothing at
// all. A real page navigation doesn't have this problem: every browser engine,
// embedded or not, honors a Content-Disposition: attachment response header on
// an actual GET. The catch is that a navigation can't carry an Authorization
// header — so the client first calls one of the *-export-link routes below
// (a normal authenticated request, reusing the exact same role/scope
// middleware as the direct CSV routes) to mint a short-lived, single-purpose
// token, then navigates the browser directly to /export/download?token=...
// The token itself — signed with the same JWT_SECRET, 2-minute expiry — is
// the only proof of authorization the download route needs; it doesn't re-run
// requireRole/requireAigScope because minting already required passing them.
const EXPORT_TOKEN_TTL = "2m";

const issueToken = (req, res, kind, extraClaims = {}) => {
  const token = jwt.sign(
    { purpose: "export", kind, sub: req.user.sub, ...extraClaims },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: EXPORT_TOKEN_TTL },
  );
  res.json({ token });
};

const getMyBookingsExportToken   = (req, res) => issueToken(req, res, "myBookings");
const getMentorCohortExportToken = (req, res) => issueToken(req, res, "mentorCohort");
const getAdminRosterExportToken  = (req, res) => issueToken(req, res, "adminRoster");
const getAigRosterExportToken    = (req, res) => issueToken(req, res, "aigRoster", { aigSlug: req.params.aigSlug });

const downloadWithToken = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "token is required" });

    let claims;
    try {
      claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ error: "This download link has expired — go back and try exporting again" });
    }
    if (claims.purpose !== "export") return res.status(401).json({ error: "Invalid download link" });

    let result;
    switch (claims.kind) {
      case "myBookings":   result = await buildMyBookingsCsv(claims.sub); break;
      case "mentorCohort": result = await buildMentorCohortCsv(claims.sub); break;
      case "adminRoster":  result = await buildAdminRosterCsv(); break;
      case "aigRoster":    result = await buildAigRosterCsv(claims.aigSlug); break;
      default: return res.status(400).json({ error: "Unknown export kind" });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    respondCsv(res, result);
  } catch (err) { next(err); }
};

module.exports = {
  exportMentorCohort, exportAdminRoster, exportAigRoster, exportMyBookings,
  getMyBookingsExportToken, getMentorCohortExportToken, getAdminRosterExportToken, getAigRosterExportToken,
  downloadWithToken,
};
