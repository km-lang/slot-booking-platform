"use strict";

const prisma  = require("../lib/prisma");
const mailer  = require("../lib/mailer");
const { buildSessionEvent, buildGoogleCalendarLink, CALENDAR_ORGANIZER_EMAIL } = require("../lib/calendarInvite");

const ALLOWED_FOCUS = ["overall", "workex", "por"];

// Records a strike and, if the new strike count exactly matches a seeded
// BanPolicyTier threshold, opens a Ban for the duration that tier specifies.
// issuedBy is the acting mentor's email — set by markAttendance's NO_SHOW path
// and by the manual strike endpoint; mirrors Ban.liftedBy. actingUserId is that
// same mentor's own user id, used only for the BAN_APPLIED audit event so it's
// shaped the same way as adminController's BAN_LIFTED event.
const applyStrikeAndMaybeBan = async (tx, userId, bookingId, reason, issuedBy = null, actingUserId = null) => {
  await tx.studentWarning.create({ data: { userId, bookingId, type: "STRIKE", reason, issuedBy } });
  const strikeCount = await tx.studentWarning.count({ where: { userId, type: "STRIKE" } });
  // Auto-banning is switched off for now (policy call, 2026-07-09) — strikes
  // still accumulate and show up everywhere as before, but no Ban row is ever
  // created off the back of one. BanPolicyTier lookup deliberately skipped.
  return { ban: null };
};

// Sends the booking confirmation email + calendar invite to both parties. Shared by
// self-service booking and mentor-initiated allocation — the resulting email is
// identical either way, since from the student's inbox the outcome is the same: a
// confirmed session.
const sendBookingConfirmationEmails = ({ claimedSlot, booking, focus, studentUserId }) => {
  prisma.user.findUnique({
    where: { id: studentUserId },
    select: { name: true, email: true, studentProfile: { select: { pgpId: true } } },
  }).then(async (student) => {
    const fmtDate = (d) =>
      new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const fmtTime = (d) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const mentorUser = await prisma.mentorProfile.findUnique({
      where: { id: claimedSlot.mentorProfileId },
      include: { user: { select: { name: true, email: true } } },
    }).catch(() => null);

    const mentorName = mentorUser?.user?.name ?? "your mentor";
    const studentName = student?.name ?? student?.email ?? "your mentee";

    const focusDescription = `${focus === "workex" ? "Work Experience" : focus === "por" ? "POR / ECA" : "Overall CV"} review session via Parthsaarthi.`;

    const icsContent = buildSessionEvent({
      uid: booking.id,
      sequence: claimedSlot.icsSequence,
      method: "REQUEST",
      status: "CONFIRMED",
      startTime: claimedSlot.startTime,
      endTime: claimedSlot.endTime,
      summary: `CV Review: ${studentName} × ${mentorName}`,
      description: focusDescription,
      location: claimedSlot.venue,
      meetingLink: claimedSlot.meetingLink ?? null,
      organizerEmail: CALENDAR_ORGANIZER_EMAIL,
      organizerName: "Parthsaarthi",
      attendees: [
        ...(student?.email ? [{ email: student.email, name: studentName }] : []),
        ...(mentorUser?.user?.email ? [{ email: mentorUser.user.email, name: mentorName }] : []),
      ],
    });
    const calendarLink = buildGoogleCalendarLink({
      summary: `CV Review: ${studentName} × ${mentorName}`,
      description: focusDescription,
      location: claimedSlot.venue,
      startTime: claimedSlot.startTime,
      endTime: claimedSlot.endTime,
    });

    // Single email to both student and mentor together (one TO: field, one calendar invite)
    mailer.sendBookingConfirmationCombined({
      studentEmail: student?.email ?? null,
      studentName,
      mentorEmail:  mentorUser?.user?.email ?? null,
      mentorName,
      pgpId:        student?.studentProfile?.pgpId ?? "N/A",
      firm:         mentorUser?.firm ?? "IIM Lucknow",
      date:         fmtDate(claimedSlot.startTime),
      time:         fmtTime(claimedSlot.startTime),
      venue:        claimedSlot.venue,
      meetingLink:  claimedSlot.meetingLink ?? null,
      focus,
      icsContent,
      calendarLink,
    }).catch((e) => console.error("[mailer] booking confirmation:", e.message));
  }).catch((e) => console.error("[mailer] student lookup:", e.message));
};

// Shared by every path that grants a student a booking (fresh, allocated, or
// reassigned) — a ban suspends all of them equally, not just self-service.
const hasActiveBan = (userId) =>
  prisma.ban
    .findFirst({
      where: {
        userId,
        liftedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    })
    .then(Boolean);

// The single source of truth for "give this student this slot" — used by both
// self-service booking (createBooking) and mentor-initiated allocation
// (allocateSlot). Returns a result object rather than throwing, so both callers
// can map { ok, status, error } straight onto their HTTP response without
// duplicating any of the race-safety or eligibility logic.
const claimSlotAndCreateBooking = async ({ slotId, studentUserId, focus, idempotencyKey, allocatedBy = null }) => {
  const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.studentUserId !== studentUserId) {
      return { ok: false, status: 409, error: "Idempotency key already in use" };
    }
    return { ok: true, replay: true, booking: existing };
  }

  if (await hasActiveBan(studentUserId)) {
    return { ok: false, status: 403, error: "This student's booking access is currently suspended" };
  }

  const bookingOpenConfig = await prisma.systemConfig.findUnique({ where: { key: "booking_open" } });
  if (bookingOpenConfig && bookingOpenConfig.value !== "true") {
    return { ok: false, status: 403, error: "Booking is currently closed" };
  }

  const claimedSlot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: { capacity: true, release: true, mentorProfile: true },
  });
  if (!claimedSlot) return { ok: false, status: 404, error: "Slot not found" };
  if (claimedSlot.startTime <= new Date()) {
    return { ok: false, status: 400, error: "This slot has already started" };
  }
  if (claimedSlot.release.cohortOnly) {
    const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: studentUserId } });
    if (!studentProfile || studentProfile.cohortId !== claimedSlot.mentorProfile.cohortId) {
      return { ok: false, status: 403, error: "This slot is reserved for the mentor's cohort" };
    }
  }
  if (!claimedSlot.capacity) {
    return { ok: false, status: 409, error: "Slot is full" };
  }

  const SLOT_FULL = Symbol("slot full");
  const MENTOR_CONFLICT = Symbol("already booked with this mentor");
  try {
    const booking = await prisma.$transaction(async (tx) => {
      // Single atomic conditional UPDATE — the WHERE clause and the increment run as
      // one statement, so Postgres serializes concurrent callers on this row and at
      // most `max` of them can ever see rowCount 1. A separate read-then-write here
      // (read capacity, decide, write) leaves a gap concurrent requests can all walk
      // through at once — confirmed empirically: that exact shape let 7 students book
      // a 1-capacity slot under concurrent load before this fix.
      const claims = await tx.$executeRaw`
        UPDATE "SlotCapacity" SET current = current + 1
        WHERE "slotId" = ${slotId} AND current < max
      `;
      if (claims === 0) throw SLOT_FULL;

      let created;
      try {
        created = await tx.booking.create({
          data: {
            slotId,
            studentUserId,
            mentorProfileId: claimedSlot.mentorProfileId,
            focus,
            idempotencyKey,
            status: "CONFIRMED",
            allocatedBy,
          },
        });
      } catch (err) {
        // Two unique constraints can fire here: idempotencyKey (already ruled out by
        // the upfront check above, bar a genuine concurrent replay) and the partial
        // index enforcing one active booking per student-mentor pair.
        if (err.code === "P2002" && !JSON.stringify(err.meta ?? {}).includes("idempotencyKey")) {
          throw MENTOR_CONFLICT;
        }
        throw err;
      }
      await tx.auditEvent.create({
        data: { userId: studentUserId, action: "BOOKING_CREATED", entity: "Booking", entityId: created.id },
      });
      return created;
    });
    return { ok: true, replay: false, booking, claimedSlot };
  } catch (err) {
    if (err === SLOT_FULL) {
      return { ok: false, status: 409, error: "Someone else just booked this slot — please refresh and try another" };
    }
    if (err === MENTOR_CONFLICT) {
      return { ok: false, status: 409, error: "This student already has an active booking with this mentor" };
    }
    if (err.code === "P2002") {
      const replay = await prisma.booking.findUnique({ where: { idempotencyKey } });
      if (replay && replay.studentUserId === studentUserId) return { ok: true, replay: true, booking: replay };
    }
    throw err;
  }
};

const createBooking = async (req, res, next) => {
  try {
    const { slotId, focus, idempotencyKey } = req.body;
    if (!slotId || !idempotencyKey || !ALLOWED_FOCUS.includes(focus)) {
      return res
        .status(400)
        .json({ error: "slotId, focus (overall|workex|por), and idempotencyKey are required" });
    }

    const result = await claimSlotAndCreateBooking({ slotId, studentUserId: req.user.sub, focus, idempotencyKey });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    if (result.replay) return res.status(200).json(result.booking);

    sendBookingConfirmationEmails({
      claimedSlot: result.claimedSlot,
      booking: result.booking,
      focus,
      studentUserId: req.user.sub,
    });

    return res.status(201).json(result.booking);
  } catch (err) {
    next(err);
  }
};

// Backs the mentor-facing search bar in the "Allocate Slot" sheet — lets a mentor
// find a student by PGP ID, name, or email instead of having to know the exact ID.
const searchStudentsForAllocation = async (req, res, next) => {
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
      take: 8,
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

const allocateSlot = async (req, res, next) => {
  try {
    const { pgpId, focus } = req.body;
    if (!pgpId || !ALLOWED_FOCUS.includes(focus)) {
      return res.status(400).json({ error: "pgpId and focus (overall|workex|por) are required" });
    }

    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "You don't own this slot" });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { pgpId: String(pgpId).trim() },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!studentProfile) return res.status(404).json({ error: "No student found with that PGP ID" });

    const idempotencyKey = `allocate-${slot.id}-${studentProfile.userId}`;
    const result = await claimSlotAndCreateBooking({
      slotId: slot.id,
      studentUserId: studentProfile.userId,
      focus,
      idempotencyKey,
      allocatedBy: req.user.email,
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    if (result.replay) return res.status(200).json(result.booking);

    sendBookingConfirmationEmails({
      claimedSlot: result.claimedSlot,
      booking: result.booking,
      focus,
      studentUserId: studentProfile.userId,
    });

    return res.status(201).json(result.booking);
  } catch (err) {
    next(err);
  }
};

// Gives an existing CONFIRMED booking to a different student, same slot/time —
// e.g. the original student dropped out and someone else is taking their place.
// The old student's booking simply disappears from their list (no cancelled
// artifact left behind) — they're notified by email only, same as the new
// student gets a normal confirmation email. Neither SlotCapacity nor the slot
// itself is touched, so occupancy stays 1/1 throughout.
const reassignBooking = async (req, res, next) => {
  try {
    const { pgpId } = req.body;
    if (!pgpId) return res.status(400).json({ error: "pgpId is required" });

    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        slot: { include: { release: true } },
        student: { select: { name: true, email: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your booking" });
    if (booking.status !== "CONFIRMED") return res.status(400).json({ error: "Booking is not active" });
    if (booking.slot.endTime <= new Date()) {
      return res.status(400).json({ error: "This session has already ended" });
    }

    const newStudentProfile = await prisma.studentProfile.findUnique({
      where: { pgpId: String(pgpId).trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!newStudentProfile) return res.status(404).json({ error: "No student found with that PGP ID" });
    if (newStudentProfile.userId === booking.studentUserId) {
      return res.status(400).json({ error: "This booking is already assigned to that student" });
    }

    if (await hasActiveBan(newStudentProfile.userId)) {
      return res.status(403).json({ error: "This student's booking access is currently suspended" });
    }

    const bookingOpenConfig = await prisma.systemConfig.findUnique({ where: { key: "booking_open" } });
    if (bookingOpenConfig && bookingOpenConfig.value !== "true") {
      return res.status(403).json({ error: "Booking is currently closed" });
    }

    if (booking.slot.release.cohortOnly && newStudentProfile.cohortId !== mentorProfile.cohortId) {
      return res.status(403).json({ error: "This slot is reserved for the mentor's cohort" });
    }

    const conflict = await prisma.booking.findFirst({
      where: { studentUserId: newStudentProfile.userId, mentorProfileId: mentorProfile.id, status: "CONFIRMED" },
    });
    if (conflict) {
      return res
        .status(409)
        .json({ error: "This student already has an active booking with this mentor — use Swap instead" });
    }

    const oldStudent = booking.student;

    const [updatedBooking] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { studentUserId: newStudentProfile.userId, allocatedBy: req.user.email },
      }),
      prisma.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "BOOKING_REASSIGNED",
          entity: "Booking",
          entityId: booking.id,
          meta: JSON.stringify({ oldStudentUserId: booking.studentUserId, newStudentUserId: newStudentProfile.userId }),
        },
      }),
    ]);

    (async () => {
      const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const mentorName = mentorProfile.user?.name ?? "your mentor";
      const newStudentName = newStudentProfile.user?.name ?? newStudentProfile.user?.email ?? "your mentee";
      const oldStudentName = oldStudent?.name ?? oldStudent?.email ?? "the student";
      const date = fmtDate(booking.slot.startTime);
      const time = fmtTime(booking.slot.startTime);
      const sequence = booking.slot.icsSequence + 1; // must exceed any prior reschedule/cancel's sequence

      if (newStudentProfile.user?.email) {
        const newIcs = buildSessionEvent({
          uid: booking.id,
          sequence,
          method: "REQUEST",
          status: "CONFIRMED",
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          summary: `CV Review: ${newStudentName} × ${mentorName}`,
          description: "CV Review session via Parthsaarthi.",
          location: booking.slot.venue,
          meetingLink: booking.slot.meetingLink ?? null,
          organizerEmail: CALENDAR_ORGANIZER_EMAIL,
          organizerName: "Parthsaarthi",
          attendees: [
            { email: newStudentProfile.user.email, name: newStudentName },
            ...(mentorProfile.user?.email ? [{ email: mentorProfile.user.email, name: mentorName }] : []),
          ],
        });
        const newCalendarLink = buildGoogleCalendarLink({
          summary: `CV Review: ${newStudentName} × ${mentorName}`,
          description: "CV Review session via Parthsaarthi.",
          location: booking.slot.venue,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
        });
        mailer.sendBookingConfirmation({
          studentEmail: newStudentProfile.user.email,
          studentName: newStudentName,
          mentorName,
          firm: mentorProfile.firm,
          date,
          time,
          venue: booking.slot.venue,
          focus: updatedBooking.focus,
          meetingLink: booking.slot.meetingLink ?? null,
          icsContent: newIcs,
          calendarLink: newCalendarLink,
        }).catch((e) => console.error("[mailer] reassign confirmation to new student:", e.message));
      }

      if (oldStudent?.email) {
        const oldIcs = buildSessionEvent({
          uid: booking.id,
          sequence,
          method: "CANCEL",
          status: "CANCELLED",
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
          summary: `CV Review: ${oldStudentName} × ${mentorName}`,
          description: "This session was reassigned to another student via Parthsaarthi.",
          location: booking.slot.venue,
          organizerEmail: CALENDAR_ORGANIZER_EMAIL,
          organizerName: "Parthsaarthi",
          attendees: [{ email: oldStudent.email, name: oldStudentName }],
        });
        mailer.sendBookingReassignedToStudent({
          studentEmail: oldStudent.email,
          studentName: oldStudentName,
          mentorName,
          date,
          time,
          icsContent: oldIcs,
        }).catch((e) => console.error("[mailer] reassign notice to old student:", e.message));
      }
    })().catch((e) => console.error("[mailer] reassign notification:", e.message));

    res.json({ id: updatedBooking.id, studentUserId: updatedBooking.studentUserId });
  } catch (err) {
    next(err);
  }
};

// Cancels a student's booking but — unlike deleteSlot — leaves the slot itself
// published and non-retired, so it immediately reappears in the mentor's Open
// Slots list for someone else to book. Only allowed before the session starts;
// once it's begun the booking has to be resolved via attendance instead.
const unassignBooking = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        slot: true,
        student: { select: { name: true, email: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your booking" });
    if (booking.status !== "CONFIRMED") return res.status(400).json({ error: "Booking is not active" });
    if (booking.slot.startTime <= new Date()) {
      return res.status(400).json({ error: "Cannot unassign once the session has started" });
    }

    const [, updatedSlot] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledBy: "MENTOR", cancelledAt: new Date() },
      }),
      prisma.slot.update({
        where: { id: booking.slot.id },
        data: { icsSequence: { increment: 1 } },
      }),
      prisma.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "BOOKING_UNASSIGNED",
          entity: "Booking",
          entityId: booking.id,
        },
      }),
    ]);

    if (booking.student?.email) {
      const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const mentorName = mentorProfile.user?.name ?? "your mentor";
      const studentName = booking.student.name ?? booking.student.email;
      const icsContent = buildSessionEvent({
        uid: booking.id,
        sequence: updatedSlot.icsSequence,
        method: "CANCEL",
        status: "CANCELLED",
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
        summary: `CV Review: ${studentName} × ${mentorName}`,
        description: "This session was cancelled via Parthsaarthi.",
        location: booking.slot.venue,
        organizerEmail: CALENDAR_ORGANIZER_EMAIL,
        organizerName: "Parthsaarthi",
        attendees: [{ email: booking.student.email, name: studentName }],
      });
      mailer.sendSlotDeletedToStudent({
        studentEmail: booking.student.email,
        studentName,
        mentorName,
        date: fmtDate(booking.slot.startTime),
        time: fmtTime(booking.slot.startTime),
        icsContent,
      }).catch((e) => console.error("[mailer] unassign notice:", e.message));
    }

    res.json({ id: booking.id, unassigned: true });
  } catch (err) {
    next(err);
  }
};

// Trades which student sits on which of the mentor's own two confirmed
// bookings — e.g. two students both want to swap their session times. Deletes
// and recreates both Booking rows rather than updating studentUserId in place:
// both rows share the same mentorProfileId, and booking_one_active_per_mentor
// (a plain, non-deferrable partial unique index on (studentUserId,
// mentorProfileId) WHERE status='CONFIRMED') would transiently collide if
// updated one at a time — row A would briefly duplicate row B's still-unswapped
// student before the second update lands. Deleting both first removes the
// conflicting index entries before either new row is inserted, so there's no
// intermediate colliding state. StudentWarning.bookingId has no DB-level FK
// (schema.prisma), so deleting a Booking row is safe. SlotCapacity is never
// touched — both slots stay at 1/1 occupancy throughout.
const swapBookings = async (req, res, next) => {
  try {
    const { bookingIdA, bookingIdB } = req.body;
    if (!bookingIdA || !bookingIdB) {
      return res.status(400).json({ error: "bookingIdA and bookingIdB are required" });
    }
    if (bookingIdA === bookingIdB) return res.status(400).json({ error: "Cannot swap a booking with itself" });

    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const include = {
      slot: { include: { release: true } },
      student: { select: { id: true, name: true, email: true } },
    };
    const [bookingA, bookingB] = await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingIdA }, include }),
      prisma.booking.findUnique({ where: { id: bookingIdB }, include }),
    ]);
    if (!bookingA || !bookingB) return res.status(404).json({ error: "Booking not found" });
    for (const b of [bookingA, bookingB]) {
      if (b.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your booking" });
      if (b.status !== "CONFIRMED") return res.status(400).json({ error: "Booking is not active" });
      if (b.slot.endTime <= new Date()) return res.status(400).json({ error: "This session has already ended" });
    }

    const [studentAProfile, studentBProfile] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: bookingA.studentUserId } }),
      prisma.studentProfile.findUnique({ where: { userId: bookingB.studentUserId } }),
    ]);
    if (await hasActiveBan(bookingA.studentUserId) || await hasActiveBan(bookingB.studentUserId)) {
      return res.status(403).json({ error: "One of these students' booking access is currently suspended" });
    }
    // Cohort restrictions are set per BookingRelease batch, not per mentor, so
    // slot A and slot B can legitimately have different cohortOnly settings
    // even though they're the same mentor's own slots.
    if (bookingA.slot.release.cohortOnly && studentBProfile?.cohortId !== mentorProfile.cohortId) {
      return res.status(403).json({ error: "One of these slots is reserved for the mentor's cohort" });
    }
    if (bookingB.slot.release.cohortOnly && studentAProfile?.cohortId !== mentorProfile.cohortId) {
      return res.status(403).json({ error: "One of these slots is reserved for the mentor's cohort" });
    }

    const now = Date.now();
    const [newBookingAtSlotA, newBookingAtSlotB] = await prisma.$transaction([
      prisma.booking.delete({ where: { id: bookingA.id } }),
      prisma.booking.delete({ where: { id: bookingB.id } }),
      prisma.booking.create({
        data: {
          slotId: bookingA.slotId,
          studentUserId: bookingB.studentUserId,
          mentorProfileId: mentorProfile.id,
          focus: bookingB.focus,
          idempotencyKey: `swap-${bookingA.slotId}-${bookingB.studentUserId}-${now}`,
          status: "CONFIRMED",
          allocatedBy: req.user.email,
        },
      }),
      prisma.booking.create({
        data: {
          slotId: bookingB.slotId,
          studentUserId: bookingA.studentUserId,
          mentorProfileId: mentorProfile.id,
          focus: bookingA.focus,
          idempotencyKey: `swap-${bookingB.slotId}-${bookingA.studentUserId}-${now}`,
          status: "CONFIRMED",
          allocatedBy: req.user.email,
        },
      }),
      prisma.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "BOOKING_SWAPPED",
          entity: "Booking",
          entityId: bookingA.id,
          meta: JSON.stringify({
            oldBookingAId: bookingA.id, oldBookingBId: bookingB.id,
            studentAUserId: bookingA.studentUserId, studentBUserId: bookingB.studentUserId,
          }),
        },
      }),
    ]).then((results) => [results[2], results[3]]);

    (async () => {
      const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const mentorName = mentorProfile.user?.name ?? "your mentor";
      const studentAName = bookingA.student?.name ?? bookingA.student?.email ?? "the student";
      const studentBName = bookingB.student?.name ?? bookingB.student?.email ?? "the student";
      // Reuse each student's OLD booking id as the ICS uid — their calendar app then
      // recognises this as an update to the event they already have, not a stray new one.
      const sequence = Math.max(bookingA.slot.icsSequence, bookingB.slot.icsSequence) + 1;

      const buildMoveIcs = (uid, studentEmail, name, otherName, fromSlot, toSlot) => ({
        icsContent: buildSessionEvent({
          uid, sequence, method: "REQUEST", status: "CONFIRMED",
          startTime: toSlot.startTime, endTime: toSlot.endTime,
          summary: `CV Review: ${name} × ${otherName}`,
          description: "This session's time was swapped with another student's via Parthsaarthi.",
          location: toSlot.venue, meetingLink: toSlot.meetingLink ?? null,
          organizerEmail: CALENDAR_ORGANIZER_EMAIL, organizerName: "Parthsaarthi",
          attendees: [
            ...(studentEmail ? [{ email: studentEmail, name }] : []),
            ...(mentorProfile.user?.email ? [{ email: mentorProfile.user.email, name: mentorName }] : []),
          ],
        }),
        calendarLink: buildGoogleCalendarLink({
          summary: `CV Review: ${name} × ${otherName}`,
          description: "This session's time was swapped with another student's.",
          location: toSlot.venue, startTime: toSlot.startTime, endTime: toSlot.endTime,
        }),
        shared: {
          oldDate: fmtDate(fromSlot.startTime), oldTime: fmtTime(fromSlot.startTime),
          newDate: fmtDate(toSlot.startTime), newTime: fmtTime(toSlot.startTime),
          venue: toSlot.venue, meetingLink: toSlot.meetingLink ?? null,
        },
      });

      const eventA = buildMoveIcs(bookingA.id, bookingA.student?.email, studentAName, mentorName, bookingA.slot, bookingB.slot);
      const eventB = buildMoveIcs(bookingB.id, bookingB.student?.email, studentBName, mentorName, bookingB.slot, bookingA.slot);

      if (bookingA.student?.email) {
        mailer.sendRescheduleNotification({
          to: bookingA.student.email, recipientName: studentAName, otherPartyName: mentorName,
          ...eventA.shared, icsContent: eventA.icsContent, calendarLink: eventA.calendarLink,
        }).catch((e) => console.error("[mailer] swap to student A:", e.message));
      }
      if (bookingB.student?.email) {
        mailer.sendRescheduleNotification({
          to: bookingB.student.email, recipientName: studentBName, otherPartyName: mentorName,
          ...eventB.shared, icsContent: eventB.icsContent, calendarLink: eventB.calendarLink,
        }).catch((e) => console.error("[mailer] swap to student B:", e.message));
      }
      if (mentorProfile.user?.email) {
        mailer.sendRescheduleNotification({
          to: mentorProfile.user.email, recipientName: mentorName, otherPartyName: studentAName,
          ...eventA.shared, icsContent: eventA.icsContent, calendarLink: eventA.calendarLink,
        }).catch((e) => console.error("[mailer] swap to mentor (A):", e.message));
        mailer.sendRescheduleNotification({
          to: mentorProfile.user.email, recipientName: mentorName, otherPartyName: studentBName,
          ...eventB.shared, icsContent: eventB.icsContent, calendarLink: eventB.calendarLink,
        }).catch((e) => console.error("[mailer] swap to mentor (B):", e.message));
      }
    })().catch((e) => console.error("[mailer] swap notification:", e.message));

    res.json({ bookingAtSlotA: newBookingAtSlotA.id, bookingAtSlotB: newBookingAtSlotB.id });
  } catch (err) {
    next(err);
  }
};

// Mentor marks attendance. NO_SHOW → STRIKE → evaluate BanPolicyTier
const markAttendance = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["ATTENDED", "NO_SHOW"].includes(status)) {
      return res.status(400).json({ error: "status must be ATTENDED or NO_SHOW" });
    }

    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { slot: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.slot.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({ error: "Booking is not active" });
    }
    if (booking.slot.startTime > new Date()) {
      return res.status(400).json({ error: "Cannot mark attendance before the session has started" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status } });

      if (status === "NO_SHOW") {
        await applyStrikeAndMaybeBan(tx, booking.studentUserId, booking.id, "No-show", req.user.email, req.user.sub);
      }

      await tx.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: status === "NO_SHOW" ? "NO_SHOW_RECORDED" : "ATTENDANCE_RECORDED",
          entity: "Booking",
          entityId: booking.id,
        },
      });
    });

    res.json({ id: booking.id, status });
  } catch (err) {
    next(err);
  }
};

// Mentor-only: manually applies a strike to a booking the student already
// cancelled — this is now the ONLY way a cancellation ever produces a strike,
// replacing the old automatic timing-based penalty. Idempotent per booking —
// a booking can only be struck once.
const applyManualStrike = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where:  { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const booking = await prisma.booking.findUnique({
      where:   { id: req.params.id },
      include: {
        slot: true,
        student: { select: { name: true, email: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (booking.status !== "CANCELLED") {
      return res.status(400).json({ error: "Only cancelled bookings can be struck" });
    }

    const alreadyStruck = await prisma.studentWarning.findFirst({
      where: { bookingId: booking.id, type: "STRIKE" },
    });
    if (alreadyStruck) return res.status(409).json({ error: "Strike already applied for this cancellation" });

    const { ban } = await prisma.$transaction(async (tx) => {
      const result = await applyStrikeAndMaybeBan(
        tx, booking.studentUserId, booking.id,
        "Mentor-applied strike for cancelled session", req.user.email, req.user.sub,
      );
      await tx.auditEvent.create({
        data: {
          userId:   req.user.sub,
          action:   "STRIKE_MANUALLY_APPLIED",
          entity:   "Booking",
          entityId: booking.id,
          meta:     JSON.stringify({ studentUserId: booking.studentUserId }),
        },
      });
      return result;
    });

    const student = booking.student;
    if (student?.email) {
      const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      mailer.sendStrikeAppliedToStudent({
        studentEmail: student.email,
        studentName:  student.name ?? student.email,
        mentorName:   mentorProfile.user?.name ?? mentorProfile.user?.email ?? "your mentor",
        date:         fmtDate(booking.slot.startTime),
        time:         fmtTime(booking.slot.startTime),
        banApplied:   !!ban,
        banDurationHours: ban?.endsAt ? Math.round((ban.endsAt.getTime() - Date.now()) / 3600000) : null,
      }).catch((e) => console.error("[mailer] strike applied:", e.message));
    }

    res.json({ id: booking.id, struck: true, banApplied: !!ban });
  } catch (err) {
    next(err);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { studentUserId: req.user.sub },
      include: {
        slot: {
          include: {
            release: { select: { cohortOnly: true } },
            mentorProfile: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { slot: { startTime: "asc" } },
    });

    const fmt = (d) =>
      new Date(d).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
      });

    const shape = (b) => ({
      id:           b.id,
      status:       b.status,
      focus:        b.focus,
      createdAt:    b.createdAt,
      cancelledBy:  b.cancelledBy ?? null,
      cancelledAt:  b.cancelledAt ?? null,
      slotStart:    b.slot.startTime,
      slotEnd:      b.slot.endTime,
      slotLabel:    fmt(b.slot.startTime),
      venue:        b.slot.venue,
      cohortOnly:   b.slot.release?.cohortOnly ?? false,
      delayMinutes: b.slot.delayMinutes ?? 0,
      meetingLink:  b.slot.meetingLink ?? null,
      mentorName:   b.slot.mentorProfile?.user?.name ?? "—",
      mentorSlug:   b.slot.mentorProfile?.slug ?? null,
      mentorEmail:  b.slot.mentorProfile?.user?.email ?? null,
      mentorPhone:  b.slot.mentorProfile?.phone ?? null,
      firm:         b.slot.mentorProfile?.firm ?? null,
      domain:       b.slot.mentorProfile?.domain ?? null,
    });

    const ongoing = bookings
      .filter((b) => b.status === "CONFIRMED" && b.slot.startTime <= now && b.slot.endTime > now)
      .map(shape);

    const upcoming = bookings
      .filter((b) => b.status === "CONFIRMED" && b.slot.startTime > now)
      .map(shape);

    const past = bookings
      .filter((b) => b.status !== "CONFIRMED" || b.slot.endTime <= now)
      .sort((a, b) => new Date(b.slot.startTime) - new Date(a.slot.startTime))
      .map(shape);

    res.json({ ongoing, upcoming, past });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBooking, allocateSlot, searchStudentsForAllocation,
  markAttendance, applyManualStrike, getMyBookings,
  reassignBooking, unassignBooking, swapBookings,
};
