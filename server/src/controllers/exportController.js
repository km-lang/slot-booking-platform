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
  const memberInclude = {
    user: {
      include: {
        bookings: true,
        bans: { where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } },
      },
    },
  };
  const cohorts = await prisma.cohort.findMany({
    where: { aigId: aig.id },
    include: {
      mentorProfiles: { select: { user: { select: { name: true } } } },
      studentProfiles: { include: memberInclude },
      sigfiStudentProfiles: { include: memberInclude },
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
    // A student belongs to a cohort via either their primary or SIGFi slot
    // (see lib/cohortMembership.js) — merge both, de-duplicated.
    const members = [...new Map([...c.studentProfiles, ...c.sigfiStudentProfiles].map((sp) => [sp.id, sp])).values()];
    return members.map((sp) => {
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

// Academic Secretary: mentor-level slot activity per AIG/Disha/Crack Tank group,
// same numbers as the dashboard (optionally windowed by session date).
const buildSecyActivityCsv = async (from, to) => {
  // Lazy require — adminController is a heavy module and this avoids any load-order coupling.
  const { computeGroupMentorActivity } = require("./adminController");
  const result = await computeGroupMentorActivity(from, to);
  if (result.error) return result;

  const headers = ["Group", "Category", "Mentor", "Total Slots", "Total Hours"];
  for (const t of ["CV", "GD", "CASE", "STOCK_PITCH"]) headers.push(`${t} Slots`, `${t} Hours`);

  const dataRows = result.mentors.map((m) => {
    const cells = [m.groupName, m.groupCategory, m.name, m.totalCount, m.totalHours];
    for (const t of ["CV", "GD", "CASE", "STOCK_PITCH"]) cells.push(m.byType[t].count, m.byType[t].hours);
    return cells;
  });

  const range = from && to ? `-${safeFilenamePart(from)}_to_${safeFilenamePart(to)}` : "";
  return {
    body: csv(headers, dataRows),
    filename: `mentoring-activity${range}-${new Date().toISOString().split("T")[0]}.csv`,
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


// ── Mentor slots-taken exports ────────────────────────────────────────────────
// One row per *taken* booking (CONFIRMED / ATTENDED / NO_SHOW — the same rule as
// the Academic Secretary dashboard's TAKEN_STATUSES, so every screen's numbers
// reconcile; CANCELLED bookings and never-taken slots are excluded). Shared by the
// individual-mentor download and the per-AIG mentor download. Scope comes ONLY
// from the `mentorWhere` the caller builds from the authenticated session/claims —
// never from request input — so a mentor can only ever get their own rows.
const SLOT_TAKEN_STATUSES = ["CONFIRMED", "ATTENDED", "NO_SHOW"];
const SLOT_TYPE_DISPLAY = { CV: "CV", GD: "Group Discussion", CASE: "Case Study", STOCK_PITCH: "Stock Pitch" };
const ROLE_DISPLAY = { SOLVER: "Solver", SHADOW: "Shadow" };
const IST = "Asia/Kolkata";
const fmtD = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: IST });
const fmtT = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });

const loadMentorSlotRows = async (mentorWhere, { withMentorColumns }) => {
  const mentors = await prisma.mentorProfile.findMany({
    where: mentorWhere,
    select: { id: true, pgpId: true, mentorType: true, user: { select: { name: true, email: true } } },
  });
  const mentorById = new Map(mentors.map((m) => [m.id, m]));
  const bookings = await prisma.booking.findMany({
    where: { mentorProfileId: { in: [...mentorById.keys()] }, status: { in: SLOT_TAKEN_STATUSES } },
    select: {
      slotType: true, focus: true, role: true, status: true, mentorProfileId: true,
      slot: { select: { startTime: true, endTime: true, venue: true, meetingLink: true } },
      student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } },
    },
  });
  bookings.sort((a, b) => b.slot.startTime - a.slot.startTime);

  const headers = [
    ...(withMentorColumns ? ["Mentor", "Mentor PGP ID", "Mentor Email", "Mentor Type"] : []),
    "Date", "Start", "End", "Venue", "Slot Type", "Focus / Role",
    "Student Name", "PGP ID", "Student Email", "Status", "Meeting Link",
  ];
  const mentorCells = (m) => (withMentorColumns ? [m.user?.name ?? "", m.pgpId, m.user?.email ?? "", m.mentorType] : []);
  const blank = (n) => Array(n).fill("");

  const rows = bookings.map((b) => {
    const m = mentorById.get(b.mentorProfileId);
    return [
      ...mentorCells(m),
      fmtD(b.slot.startTime), fmtT(b.slot.startTime), fmtT(b.slot.endTime), b.slot.venue,
      SLOT_TYPE_DISPLAY[b.slotType] ?? b.slotType,
      b.slotType === "CASE" ? (ROLE_DISPLAY[b.role] ?? "") : (FOCUS_DISPLAY[b.focus] ?? b.focus ?? ""),
      b.student?.name ?? "", b.student?.studentProfile?.pgpId ?? "", b.student?.email ?? "",
      STATUS_DISPLAY[b.status] ?? b.status, b.slot.meetingLink ?? "",
    ];
  });

  // Mentors with nothing taken still get a visible row, so a file is never a
  // bare header (which reads as "the export is broken").
  const withRows = new Set(bookings.map((b) => b.mentorProfileId));
  for (const m of mentors) {
    if (withRows.has(m.id)) continue;
    const cells = [...mentorCells(m), "No slots taken yet", ...blank(headers.length - mentorCells(m).length - 1)];
    rows.push(cells);
  }
  if (withMentorColumns) rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { headers, rows, mentorCount: mentors.length };
};

const buildMentorSlotsCsv = async (mentorUserId) => {
  const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: mentorUserId } });
  if (!mentorProfile) return { status: 403, error: "No mentor profile" };
  const { headers, rows } = await loadMentorSlotRows({ id: mentorProfile.id }, { withMentorColumns: false });
  return {
    body: csv(headers, rows),
    filename: `my-slots-taken-${safeFilenamePart(mentorProfile.pgpId)}-${new Date().toISOString().split("T")[0]}.csv`,
  };
};

// Built from mentor membership (MentorProfile.aigId) — not student cohorts, which
// most AIGs don't have — so it works for every AIG.
const buildAigMentorSlotsCsv = async (aigSlug) => {
  const aig = await prisma.aIG.findUnique({ where: { slug: String(aigSlug ?? "") } });
  if (!aig) return { status: 404, error: "AIG not found" };
  const { headers, rows, mentorCount } = await loadMentorSlotRows({ aigId: aig.id }, { withMentorColumns: true });
  if (mentorCount === 0) return { status: 404, error: "This AIG has no mentors yet" };
  return {
    body: csv(headers, rows),
    filename: `aig-${safeFilenamePart(aig.slug)}-mentor-slots-${new Date().toISOString().split("T")[0]}.csv`,
  };
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

const exportMentorSlots = async (req, res, next) => {
  try {
    const result = await buildMentorSlotsCsv(req.user.sub);
    if (result.error) return res.status(result.status).json({ error: result.error });
    respondCsv(res, result);
  } catch (err) { next(err); }
};

const exportAigMentorSlots = async (req, res, next) => {
  try {
    const result = await buildAigMentorSlotsCsv(req.params.aigSlug);
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
const getMentorSlotsExportToken = (req, res) => issueToken(req, res, "mentorSlots");
const getAigMentorSlotsExportToken = (req, res) => issueToken(req, res, "aigMentorSlots", { aigSlug: req.params.aigSlug });
const getAdminRosterExportToken  = (req, res) => issueToken(req, res, "adminRoster");
const getAigRosterExportToken    = (req, res) => issueToken(req, res, "aigRoster", { aigSlug: req.params.aigSlug });

const getSecyActivityExportToken = (req, res) => {
  const { from, to } = req.query;
  if ((from && !to) || (!from && to)) return res.status(400).json({ error: "Both from and to are required together" });
  issueToken(req, res, "secyActivity", from && to ? { from: String(from), to: String(to) } : {});
};

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
      case "mentorSlots":  result = await buildMentorSlotsCsv(claims.sub); break;
      case "aigMentorSlots": result = await buildAigMentorSlotsCsv(claims.aigSlug); break;
      case "adminRoster":  result = await buildAdminRosterCsv(); break;
      case "aigRoster":    result = await buildAigRosterCsv(claims.aigSlug); break;
      case "secyActivity": result = await buildSecyActivityCsv(claims.from, claims.to); break;
      default: return res.status(400).json({ error: "Unknown export kind" });
    }
    if (result.error) return res.status(result.status).json({ error: result.error });
    respondCsv(res, result);
  } catch (err) { next(err); }
};

module.exports = {
  exportMentorSlots, exportAigMentorSlots, getMentorSlotsExportToken, getAigMentorSlotsExportToken,
  exportMentorCohort, exportAdminRoster, exportAigRoster, exportMyBookings,
  getMyBookingsExportToken, getMentorCohortExportToken, getAdminRosterExportToken, getAigRosterExportToken,
  getSecyActivityExportToken,
  downloadWithToken,
};
