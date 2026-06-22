"use strict";

const { PrismaClient } = require("@prisma/client");

// For SQLite (dev): force a single connection so all writes serialize at the
// Prisma queue level rather than racing at SQLite's write-lock.  This prevents
// SQLITE_BUSY / socket-timeout errors under burst traffic (e.g. 50 students
// booking simultaneously in a stress test).
// For PostgreSQL (prod): the connection_limit param is silently ignored because
// the URL format differs, so this branch is never reached.
let url = process.env.DATABASE_URL ?? "";
if (url.startsWith("file:") && !url.includes("connection_limit")) {
  url += url.includes("?") ? "&connection_limit=1" : "?connection_limit=1";
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

module.exports = prisma;
