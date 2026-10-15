"use strict";

// Emails allowed to use the read-only "view as" role switcher (see
// authController.viewAs). Kept in code, not the DB, so granting it never needs a
// migration or a data change; extend via VIEWER_EMAILS (comma-separated) in .env.
const DEFAULT_VIEWERS = ["pgp41137@iiml.ac.in"];

const viewerEmails = () =>
  new Set([
    ...DEFAULT_VIEWERS,
    ...(process.env.VIEWER_EMAILS ?? "").split(",").map((e) => e.trim()),
  ].filter(Boolean).map((e) => e.toLowerCase()));

const isViewer = (email) => !!email && viewerEmails().has(String(email).toLowerCase());

module.exports = { isViewer };
