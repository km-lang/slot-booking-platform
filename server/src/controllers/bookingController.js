"use strict";

const prisma  = require("../lib/prisma");
const mailer  = require("../lib/mailer");
const { buildSessionEvent } = require("../lib/calendarInvite");

const CALENDAR_ORGANIZER_EMAIL = process.env.SMTP_FROM?.match(/<(.+)>/)?.[1] ?? "noreply@iiml.ac.in";

// Read penalty thresholds from SystemConfig; fall back to built-in defaults.
const getPenaltyThresholds = async () => {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ["penalty_warning_minutes", "penalty_strike_minutes", "penalty_warning_to_strike"] } },
  });
  const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    warningMinutes:      Number(cfg.penalty_warning_minutes      ?? 60),
    strikeMinutes:       Number(cfg.penalty_strike_minutes       ?? 30),
    warningToStrikeAt:   Number(cfg.penalty_warning_to_strike    ?? 3),
  };
};

const ALLOWED_FOCUS = ["overall", "workex", "por"];

// Records a strike and, if the new strike count exactly matches a seeded
// BanPolicyTier threshold, opens a Ban for the duration that tier specifies.
const applyStrikeAndMaybeBan = async (tx, userId, bookingId, reason) => {
  await tx.studentWarning.create({ data: { userId, bookingId, type: "STRIKE", reason } });
  const strikeCount = await tx.studentWarning.count({ where: { userId, type: "STRIKE" } });
  const tier = await tx.banPolicyTier.findUnique({ where: { strikeThreshold: strikeCount } });
  if (tier) {
    const endsAt = tier.banDurationHours ? new Date(Date.now() + tier.banDurationHours * 3600 * 1000) : null;
    await tx.ban.create({ data: { userId, reason: tier.description, endsAt } });
  }
};

// Every N warnings (configurable via SystemConfig) auto-converts into 1 strike.
const applyWarning = async (tx, userId, bookingId, reason, warningToStrikeAt = 3) => {
  await tx.studentWarning.create({ data: { userId, bookingId, type: "WARNING", reason } });
  const warningCount = await tx.studentWarning.count({ where: { userId, type: "WARNING" } });
  if (warningCount % warningToStrikeAt === 0) {
    await applyStrikeAndMaybeBan(tx, userId, bookingId, `${warningToStrikeAt} warnings converted to 1 strike`);
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

    const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.studentUserId !== req.user.sub) {
        return res.status(409).json({ error: "Idempotency key already in use" });
      }
      return res.status(200).json(existing);
    }

    const activeBan = await prisma.ban.findFirst({
      where: {
        userId: req.user.sub,
        liftedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
    });
    if (activeBan) return res.status(403).json({ error: "Your booking access is currently suspended" });

    const bookingOpenConfig = await prisma.systemConfig.findUnique({ where: { key: "booking_open" } });
    if (bookingOpenConfig && bookingOpenConfig.value !== "true") {
      return res.status(403).json({ error: "Booking is currently closed" });
    }

    let claimedSlot = null;
    for (let attempt = 0; attempt < 3 && !claimedSlot; attempt++) {
      const slot = await prisma.slot.findUnique({
        where: { id: slotId },
        include: { capacity: true, release: true, mentorProfile: true },
      });
      if (!slot) return res.status(404).json({ error: "Slot not found" });
      if (slot.startTime <= new Date()) {
        return res.status(400).json({ error: "This slot has already started" });
      }
      if (slot.release.cohortOnly) {
        const studentProfile = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } });
        if (!studentProfile || studentProfile.cohortId !== slot.mentorProfile.cohortId) {
          return res.status(403).json({ error: "This slot is reserved for the mentor's cohort" });
        }
      }
      if (!slot.capacity || slot.capacity.current >= slot.capacity.max) {
        return res.status(409).json({ error: "Slot is full" });
      }

      const result = await prisma.slot.updateMany({
        where: { id: slotId, version: slot.version },
        data: { version: { increment: 1 } },
      });
      if (result.count === 1) claimedSlot = slot;
    }

    if (!claimedSlot) {
      return res.status(409).json({ error: "Someone else just booked this slot — please refresh and try another" });
    }

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: { slotId, studentUserId: req.user.sub, focus, idempotencyKey, status: "CONFIRMED" },
        });
        await tx.slotCapacity.update({ where: { slotId }, data: { current: { increment: 1 } } });
        await tx.auditEvent.create({
          data: { userId: req.user.sub, action: "BOOKING_CREATED", entity: "Booking", entityId: created.id },
        });
        return created;
      });

      // Send booking confirmation email + calendar invite (non-blocking)
      prisma.user.findUnique({
        where: { id: req.user.sub },
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

        const icsContent = buildSessionEvent({
          uid: booking.id,
          sequence: 0,
          method: "REQUEST",
          status: "CONFIRMED",
          startTime: claimedSlot.startTime,
          endTime: claimedSlot.endTime,
          summary: `CV Review: ${studentName} × ${mentorName}`,
          description: `${focus === "workex" ? "Work Experience" : focus === "por" ? "POR / ECA" : "Overall CV"} review session via Parthsaarthi.`,
          location: claimedSlot.venue,
          organizerEmail: CALENDAR_ORGANIZER_EMAIL,
          organizerName: "Parthsaarthi",
          attendees: [
            ...(student?.email ? [{ email: student.email, name: studentName }] : []),
            ...(mentorUser?.user?.email ? [{ email: mentorUser.user.email, name: mentorName }] : []),
          ],
        });

        if (student?.email) {
          mailer.sendBookingConfirmation({
            studentEmail: student.email,
            studentName,
            mentorName,
            firm:         mentorUser?.firm ?? "IIM Lucknow",
            date:         fmtDate(claimedSlot.startTime),
            time:         fmtTime(claimedSlot.startTime),
            venue:        claimedSlot.venue,
            focus,
            icsContent,
          }).catch((e) => console.error("[mailer] booking confirmation:", e.message));
        }
        if (mentorUser?.user?.email) {
          mailer.sendBookingConfirmationToMentor({
            mentorEmail: mentorUser.user.email,
            mentorName,
            studentName,
            pgpId:       student?.studentProfile?.pgpId ?? "N/A",
            date:        fmtDate(claimedSlot.startTime),
            time:        fmtTime(claimedSlot.startTime),
            venue:       claimedSlot.venue,
            focus,
            icsContent,
          }).catch((e) => console.error("[mailer] booking confirmation to mentor:", e.message));
        }
      }).catch((e) => console.error("[mailer] student lookup:", e.message));

      return res.status(201).json(booking);
    } catch (err) {
      if (err.code === "P2002") {
        const replay = await prisma.booking.findUnique({ where: { idempotencyKey } });
        if (replay && replay.studentUserId === req.user.sub) return res.status(200).json(replay);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// Penalty tiers — thresholds configurable via SystemConfig:
//   ≥ warningMinutes before slot start → no penalty
//   strikeMinutes–(warningMinutes-1) min before → WARNING
//   < strikeMinutes before / after start → STRIKE
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where:   { id: req.params.id },
      include: {
        slot: {
          include: {
            mentorProfile: { include: { user: { select: { name: true, email: true } } } },
          },
        },
        student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } },
      },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.studentUserId !== req.user.sub) return res.status(403).json({ error: "Not your booking" });
    if (booking.status !== "CONFIRMED") return res.status(400).json({ error: "Booking is not active" });

    const { warningMinutes, strikeMinutes, warningToStrikeAt } = await getPenaltyThresholds();
    const minutesBeforeStart = (booking.slot.startTime.getTime() - Date.now()) / 60000;
    let penalty = "NONE";

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      await tx.slotCapacity.update({ where: { slotId: booking.slotId }, data: { current: { decrement: 1 } } });

      if (minutesBeforeStart >= warningMinutes) {
        penalty = "NONE";
      } else if (minutesBeforeStart >= strikeMinutes) {
        penalty = "WARNING";
        await applyWarning(tx, booking.studentUserId, booking.id,
          `Late cancellation (${strikeMinutes}–${warningMinutes - 1} min before slot)`, warningToStrikeAt);
      } else {
        penalty = "STRIKE";
        await applyStrikeAndMaybeBan(tx, booking.studentUserId, booking.id,
          `Late cancellation (<${strikeMinutes} min before slot)`);
      }

      await tx.auditEvent.create({
        data: {
          userId:   req.user.sub,
          action:   "BOOKING_CANCELLED",
          entity:   "Booking",
          entityId: booking.id,
          meta:     JSON.stringify({ penalty }),
        },
      });
    });

    const fmtDate = (d) =>
      new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const fmtTime = (d) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const mentor  = booking.slot.mentorProfile?.user;
    const student = booking.student;

    const studentName = student?.name ?? student?.email ?? "the student";
    const mentorName  = mentor?.name ?? mentor?.email ?? "the mentor";
    const cancelIcsContent = buildSessionEvent({
      uid: booking.id,
      sequence: 1,
      method: "CANCEL",
      status: "CANCELLED",
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      summary: `CV Review: ${studentName} × ${mentorName}`,
      description: "This session was cancelled via Parthsaarthi.",
      location: booking.slot.venue,
      organizerEmail: CALENDAR_ORGANIZER_EMAIL,
      organizerName: "Parthsaarthi",
      attendees: [
        ...(student?.email ? [{ email: student.email, name: studentName }] : []),
        ...(mentor?.email ? [{ email: mentor.email, name: mentorName }] : []),
      ],
    });

    // Always notify the student of their cancellation
    if (student?.email) {
      mailer.sendCancelConfirmationToStudent({
        studentEmail: student.email,
        studentName:  student.name ?? student.email,
        mentorName:   mentor?.name ?? "your mentor",
        date:         fmtDate(booking.slot.startTime),
        time:         fmtTime(booking.slot.startTime),
        penalty,
        icsContent: cancelIcsContent,
      }).catch((e) => console.error("[mailer] cancel confirmation:", e.message));
    }

    // Always keep the mentor's calendar in sync, regardless of penalty
    if (mentor?.email) {
      mailer.sendBookingCancelledToMentor({
        mentorEmail: mentor.email,
        mentorName:  mentor.name ?? mentor.email,
        studentName,
        pgpId:       student?.studentProfile?.pgpId ?? "N/A",
        date:        fmtDate(booking.slot.startTime),
        time:        fmtTime(booking.slot.startTime),
        icsContent:  cancelIcsContent,
      }).catch((e) => console.error("[mailer] booking cancelled to mentor:", e.message));
    }

    // Notify mentor only for penalised cancellations
    if (penalty !== "NONE" && mentor?.email) {
      mailer.sendLateCancelToMentor({
        mentorEmail:  mentor.email,
        mentorName:   mentor.name ?? mentor.email,
        studentName:  student?.name ?? req.user.email,
        pgpId:        student?.studentProfile?.pgpId ?? "N/A",
        date:         fmtDate(booking.slot.startTime),
        time:         fmtTime(booking.slot.startTime),
        penalty,
      }).catch((e) => console.error("[mailer] late cancel to mentor:", e.message));
    }

    res.json({ id: booking.id, status: "CANCELLED", penalty });
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

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status } });

      if (status === "NO_SHOW") {
        await applyStrikeAndMaybeBan(tx, booking.studentUserId, booking.id, "No-show");
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
              include: { user: { select: { name: true } } },
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
      slotStart:    b.slot.startTime,
      slotEnd:      b.slot.endTime,
      slotLabel:    fmt(b.slot.startTime),
      venue:        b.slot.venue,
      cohortOnly:   b.slot.release?.cohortOnly ?? false,
      delayMinutes: b.slot.delayMinutes ?? 0,
      mentorName:   b.slot.mentorProfile?.user?.name ?? "—",
      mentorSlug:   b.slot.mentorProfile?.slug ?? null,
      firm:         b.slot.mentorProfile?.firm ?? null,
      domain:       b.slot.mentorProfile?.domain ?? null,
    });

    const upcoming = bookings
      .filter((b) => b.status === "CONFIRMED" && b.slot.startTime > now)
      .map(shape);

    const past = bookings
      .filter((b) => b.status !== "CONFIRMED" || b.slot.startTime <= now)
      .sort((a, b) => new Date(b.slot.startTime) - new Date(a.slot.startTime))
      .map(shape);

    res.json({ upcoming, past });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, cancelBooking, markAttendance, getMyBookings };
