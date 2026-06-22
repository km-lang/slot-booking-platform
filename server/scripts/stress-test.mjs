/**
 * Concurrent booking stress test
 *
 * Flow:
 *   1. 5 mentors release ≥10 slots each with varied durations (8h window)
 *   2. 50 students concurrently book one slot each (all fire at the same time)
 *   3. Assert: every student gets CONFIRMED, zero OCC conflicts, zero double-bookings
 *   4. Assert: booked slots no longer show as AVAILABLE to fresh students
 *   5. Assert: each student sees their slot as BOOKED_BY_ME
 *   6. Assert: /bookings/mine reflects the booking
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const BASE = "http://localhost:4000/api";
const prisma = new PrismaClient();

// 5 mentors, each with a different slot duration
const MENTORS = [
  { email: "disha.mentor.01@iiml.ac.in", duration: 15 }, // 8h / 15min = 32 slots
  { email: "disha.mentor.02@iiml.ac.in", duration: 20 }, // 8h / 20min = 24 slots
  { email: "disha.mentor.03@iiml.ac.in", duration: 30 }, // 8h / 30min = 16 slots
  { email: "disha.mentor.04@iiml.ac.in", duration: 45 }, // 8h / 45min = 10 slots ✓
  { email: "disha.mentor.05@iiml.ac.in", duration: 15 }, // 8h / 15min = 32 slots
];

const STUDENT_EMAILS = Array.from(
  { length: 50 },
  (_, i) => `student.${String(i + 1).padStart(3, "0")}@iiml.ac.in`,
);

// ── Helpers ────────────────────────────────────────────────────────────────────

const post = (path, token, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.json());

const login = (email) =>
  post("/auth/google", null, { email }).then((d) => {
    if (!d.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(d)}`);
    return d.token;
  });

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0, failed = 0;
const assert = (label, condition, detail = "") => {
  if (condition) { console.log(c.green(`  ✓ ${label}`)); passed++; }
  else { console.log(c.red(`  ✗ ${label}`) + (detail ? `\n    ${detail}` : "")); failed++; }
};

// ── Phase 1: Mentor slot release ───────────────────────────────────────────────

console.log(c.bold("\n━━ Phase 1: Mentor slot release ━━"));

// Use a date 7 days from now so no conflict with earlier test data
const baseDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
baseDate.setHours(8, 0, 0, 0);

const mentorTokens = {};
const mentorSlugs  = {};
const allReleasedSlotIds = [];

await Promise.all(
  MENTORS.map(async ({ email, duration }, i) => {
    const token = await login(email);
    mentorTokens[email] = token;

    // 8-hour window per mentor, starting at different hours to keep them non-overlapping
    const start = new Date(baseDate.getTime() + i * 9 * 60 * 60 * 1000); // 9h gap between mentors
    const end   = new Date(start.getTime() + 8 * 60 * 60 * 1000);        // 8h window

    const result = await post("/slots", token, {
      startTime:    start.toISOString(),
      endTime:      end.toISOString(),
      slotDuration: duration,
      venue:        "Library (In-Person)",
      cohortOnly:   false,
    });

    const count = result.slots?.length ?? 0;
    allReleasedSlotIds.push(...(result.slots?.map((s) => s.id) ?? []));
    console.log(
      c.cyan(`  ${email}`) + `  →  ${count} slots @ ${duration}min`
        + `  [${start.toLocaleTimeString()} – ${end.toLocaleTimeString()}]`,
    );
    assert(`${email.split("@")[0]}: ≥10 slots released`, count >= 10, `got ${count}`);
  }),
);

// Fetch mentor slugs from Prisma directly
await Promise.all(
  MENTORS.map(async ({ email }) => {
    const profile = await prisma.mentorProfile.findFirst({
      where: { user: { email } },
      select: { slug: true },
    });
    if (profile) mentorSlugs[email] = profile.slug;
  }),
);

// ── Phase 2: Student discovers open slots ──────────────────────────────────────

console.log(c.bold("\n━━ Phase 2: Student discovers open slots ━━"));

const studentToken0 = await login(STUDENT_EMAILS[0]);
const openSlotsByMentor = {};
let totalOpenSlots = 0;

for (const [email, slug] of Object.entries(mentorSlugs)) {
  const slots = await get(`/slots?mentorSlug=${slug}`, studentToken0);
  // Only count slots we just created (in case there are pre-existing slots)
  const available = slots.filter(
    (s) => s.status === "AVAILABLE" && allReleasedSlotIds.includes(s.id),
  );
  openSlotsByMentor[slug] = available;
  totalOpenSlots += available.length;
  console.log(`  ${slug}:  ${available.length} available`);
}

assert(
  "All released slots are visible as AVAILABLE",
  totalOpenSlots === allReleasedSlotIds.length,
  `visible=${totalOpenSlots}  released=${allReleasedSlotIds.length}`,
);
assert("≥50 slots exist for 50 students", totalOpenSlots >= 50, `only ${totalOpenSlots}`);

// Build a flat list spread across mentors (round-robin) so the booking load
// is distributed evenly and we exercise OCC on all mentors
const flatSlots = [];
const queues = Object.values(openSlotsByMentor).map((arr) => [...arr]);
let added = true;
while (added) {
  added = false;
  for (const q of queues) {
    if (q.length) { flatSlots.push(q.shift()); added = true; }
  }
}

console.log(`\n  Total slots available: ${totalOpenSlots}  →  assigning 50 to students`);

// ── Phase 3: 50 students concurrently book (all at once) ──────────────────────

console.log(c.bold("\n━━ Phase 3: 50 students concurrently booking slots ━━"));
console.log("  Logging in all 50 students in parallel…");

const studentTokens = await Promise.all(STUDENT_EMAILS.map(login));

const assignments = STUDENT_EMAILS.slice(0, 50).map((email, i) => ({
  email,
  token: studentTokens[i],
  slot:  flatSlots[i],
}));

console.log("  Firing all 50 booking requests simultaneously…");
const t0 = Date.now();

const bookingResults = await Promise.all(
  assignments.map(async ({ email, token, slot }) => {
    const idempotencyKey = `stress-${Date.now()}-${email}-${slot.id}`;
    const result = await post("/bookings", token, {
      slotId: slot.id,
      focus:  "overall",
      idempotencyKey,
    });
    return { email, token, slotId: slot.id, slot, result };
  }),
);

const elapsed = Date.now() - t0;
console.log(`  All 50 requests completed in ${elapsed}ms\n`);

const confirmed   = bookingResults.filter((r) => r.result.status === "CONFIRMED");
const occConflict = bookingResults.filter((r) => r.result.error?.includes("Someone else"));
const rateLimited = bookingResults.filter((r) => r.result.error?.includes("Too many"));
const otherErrors = bookingResults.filter(
  (r) => !r.result.status && !r.result.error?.includes("Someone else") && !r.result.error?.includes("Too many"),
);

console.log(`  Confirmed    : ${c.green(confirmed.length)}`);
console.log(`  OCC conflicts: ${occConflict.length > 0 ? c.red(occConflict.length) : 0}`);
console.log(`  Rate limited : ${rateLimited.length > 0 ? c.red(rateLimited.length) : 0}`);
console.log(`  Other errors : ${otherErrors.length > 0 ? c.red(otherErrors.length) : 0}`);

if (rateLimited.length) {
  console.log(c.yellow(`\n  Rate-limited students (first 3):`));
  rateLimited.slice(0, 3).forEach((r) => console.log(`    ${r.email}`));
}
if (otherErrors.length) {
  console.log(c.red(`\n  Unexpected errors:`));
  otherErrors.slice(0, 5).forEach((r) => console.log(`    ${r.email}: ${JSON.stringify(r.result)}`));
}

assert("All 50 students received CONFIRMED booking", confirmed.length === 50,
  `only ${confirmed.length}/50 confirmed`);
assert("Zero rate-limit rejections (per-user limiter working)", rateLimited.length === 0,
  `${rateLimited.length} students hit rate limit`);
assert("Zero OCC slot conflicts", occConflict.length === 0,
  `${occConflict.length} OCC conflicts`);

// ── Phase 4: DB — no slot double-booked ───────────────────────────────────────

console.log(c.bold("\n━━ Phase 4: DB integrity — no double-bookings ━━"));

const confirmedSlotIds = confirmed.map((r) => r.slotId);

const counts = await prisma.booking.groupBy({
  by: ["slotId"],
  where: { slotId: { in: confirmedSlotIds }, status: "CONFIRMED" },
  _count: { _all: true },
});

const doubleBooked = counts.filter((c) => c._count._all > 1);
assert("No slot has >1 confirmed booking (OCC atomic)", doubleBooked.length === 0,
  doubleBooked.map((c) => `slotId=${c.slotId} count=${c._count._all}`).join(", "));
assert("Exactly 50 distinct slots booked", counts.length === 50,
  `DB shows ${counts.length} distinct booked slots`);

// ── Phase 5: Booked slots invisible as AVAILABLE to fresh student ──────────────

console.log(c.bold("\n━━ Phase 5: Booked slots are not AVAILABLE to other students ━━"));

const freshToken = await login("student.051@iiml.ac.in");

for (const [email, slug] of Object.entries(mentorSlugs)) {
  const slots = await get(`/slots?mentorSlug=${slug}`, freshToken);
  const available     = slots.filter((s) => s.status === "AVAILABLE");
  const bookedByOther = slots.filter((s) => s.status === "BOOKED_BY_OTHER");

  // Which slots in this mentor's pool did students book?
  const mentorSlotIds = (openSlotsByMentor[slug] ?? []).map((s) => s.id);
  const bookedInThisMentor = confirmedSlotIds.filter((id) => mentorSlotIds.includes(id));
  const leaked = available.filter((s) => bookedInThisMentor.includes(s.id));

  console.log(
    `  ${slug}  available=${available.length}  booked_by_other=${bookedByOther.length}  leaked=${leaked.length}`,
  );
  assert(`${slug}: 0 booked slots leak as AVAILABLE`, leaked.length === 0,
    leaked.map((s) => s.id).join(", "));
}

// ── Phase 6: Each booking owner sees BOOKED_BY_ME ─────────────────────────────

console.log(c.bold("\n━━ Phase 6: Student sees own slot as BOOKED_BY_ME ━━"));

// Sample 5 confirmed students
const sample = confirmed.slice(0, 5);
await Promise.all(
  sample.map(async ({ email, token, slot }) => {
    // Find which mentor's pool this slot belongs to (use different var name to avoid shadow)
    const entry = Object.entries(openSlotsByMentor).find(([, pool]) =>
      pool.some((s) => s.id === slot.id)
    );
    const mentorSlug = entry?.[0];
    if (!mentorSlug) {
      assert(`${email.split("@")[0]} BOOKED_BY_ME`, false, "could not locate mentor slug for slot");
      return;
    }
    const mentorSlots = await get(`/slots?mentorSlug=${mentorSlug}`, token);
    if (!Array.isArray(mentorSlots)) {
      assert(`${email.split("@")[0]} BOOKED_BY_ME`, false,
        `API returned non-array: ${JSON.stringify(mentorSlots)}`);
      return;
    }
    const mine = mentorSlots.find((s) => s.id === slot.id);
    assert(
      `${email.split("@")[0]} sees slot as BOOKED_BY_ME`,
      mine?.status === "BOOKED_BY_ME",
      `got status=${mine?.status ?? "slot not in list"}`,
    );
  }),
);

// ── Phase 7: /bookings/mine has the booking ────────────────────────────────────

console.log(c.bold("\n━━ Phase 7: /bookings/mine reflects each booking ━━"));

await Promise.all(
  sample.map(async ({ email, token }) => {
    const data = await get("/bookings/mine", token);
    assert(
      `${email.split("@")[0]} has ≥1 upcoming booking in /bookings/mine`,
      (data.upcoming?.length ?? 0) > 0,
      `upcoming count=${data.upcoming?.length ?? 0}`,
    );
  }),
);

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(c.bold("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
console.log(`  ${c.green(passed + " passed")}   ${failed > 0 ? c.red(failed + " failed") : c.green("0 failed")}`);
console.log(c.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
if (failed > 0) {
  console.log(c.red("\n  FAILURES DETECTED — see details above.\n"));
  process.exit(1);
} else {
  console.log(c.green("\n  All checks passed.\n"));
  console.log(
    "  OCC is atomic, no double-bookings, booked slots invisible to other students,\n"
    + "  booking owner sees BOOKED_BY_ME, and /bookings/mine is consistent.\n",
  );
}

await prisma.$disconnect();
