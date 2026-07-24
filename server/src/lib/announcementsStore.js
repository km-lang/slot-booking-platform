"use strict";

const fs   = require("fs/promises");
const path = require("path");

// File-backed store for the announcement/feedback popup — deliberately not a DB
// table. This data doesn't need transactional guarantees, migrations, or backup
// discipline the way booking/slot data does; it's just "has this user already
// answered this prompt" plus whatever they answered.
//
// announcements.json  — authored content, hand-edited to publish a new prompt.
//   [{ id, type: "feature"|"feedback", title, message, active, roles, createdAt }]
//   `roles`: null = everyone, or an array like ["STUDENT","MENTOR"].
// announcement_responses.json — append-only log of what each user answered.
//   [{ announcementId, userId, email, role, response, rating, respondedAt }]
//   `response`: "acknowledged" (feature) | "rating"|"skipped" (feedback).
const DATA_DIR          = path.join(__dirname, "../../data");
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, "announcements.json");
const RESPONSES_FILE     = path.join(DATA_DIR, "announcement_responses.json");

const readJsonArray = async (file) => {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
};

const readAnnouncements = () => readJsonArray(ANNOUNCEMENTS_FILE);
const readResponses     = () => readJsonArray(RESPONSES_FILE);

// Serializes writes so two near-simultaneous responses can't race a
// read-modify-write cycle and silently drop one of them — fine as a plain
// in-memory promise chain since PM2 runs this app as a single fork-mode
// process, never clustered.
let writeQueue = Promise.resolve();
const withWriteLock = (fn) => {
  const result = writeQueue.then(fn);
  writeQueue = result.catch(() => {}); // one failed write shouldn't wedge the queue
  return result;
};

// Upserts by (announcementId, userId) — a duplicate submit (double-click,
// retry) overwrites the same row instead of appending a second one.
const recordResponse = (entry) =>
  withWriteLock(async () => {
    const responses = await readResponses();
    const filtered = responses.filter(
      (r) => !(r.announcementId === entry.announcementId && r.userId === entry.userId),
    );
    filtered.push(entry);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(RESPONSES_FILE, JSON.stringify(filtered, null, 2));
    return entry;
  });

module.exports = { readAnnouncements, readResponses, recordResponse };
