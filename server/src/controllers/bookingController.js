"use strict";

const prisma = require("../lib/prisma");

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

// Every 3rd warning auto-converts into 1 additional strike.
const applyWarning = async (tx, userId, bookingId, reason) => {
  await tx.studentWarning.create({ data: { userId, bookingId, type: "WARNING", reason } });
  const warningCount = await tx.studentWarning.count({ where: { userId, type: "WARNING" } });
  if (warningCount % 3 === 0) {
    await applyStrikeAndMaybeBan(tx, userId, bookingId, "3 warnings converted to 1 strike");
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
    if (existing) return res.status(200).json(existing);

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
      return res.status(201).json(booking);
    } catch (err) {
      if (err.code === "P2002") {
        const replay = await prisma.booking.findUnique({ where: { idempotencyKey } });
        if (replay) return res.status(200).json(replay);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// Penalty tiers:
//   ≥ 60 min before slot start → no penalty
//   30–59 min before → WARNING (3 warnings auto-convert to 1 STRIKE)
//   < 30 min before / after start → STRIKE directly
const cancelBooking = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { slot: true },
    });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.studentUserId !== req.user.sub) return res.status(403).json({ error: "Not your booking" });
    if (booking.status !== "CONFIRMED") return res.status(400).json({ error: "Booking is not active" });

    const minutesBeforeStart = (booking.slot.startTime.getTime() - Date.now()) / 60000;
    let penalty = "NONE";

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
      await tx.slotCapacity.update({ where: { slotId: booking.slotId }, data: { current: { decrement: 1 } } });

      if (minutesBeforeStart >= 60) {
        penalty = "NONE";
      } else if (minutesBeforeStart >= 30) {
        penalty = "WARNING";
        await applyWarning(tx, booking.studentUserId, booking.id, "Late cancellation (30-59 min before slot)");
      } else {
        penalty = "STRIKE";
        await applyStrikeAndMaybeBan(tx, booking.studentUserId, booking.id, "Late cancellation (<30 min before slot)");
      }

      await tx.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "BOOKING_CANCELLED",
          entity: "Booking",
          entityId: booking.id,
          meta: JSON.stringify({ penalty }),
        },
      });
    });

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

module.exports = { createBooking, cancelBooking, markAttendance };
