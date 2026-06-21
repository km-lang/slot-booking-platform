"use strict";

const prisma = require("../lib/prisma");

const listAigs = async (_req, res, next) => {
  try {
    const aigs = await prisma.aIG.findMany({
      include: { _count: { select: { mentorProfiles: true } } },
      orderBy: { name: "asc" },
    });
    res.json(
      aigs.map((aig) => ({
        id: aig.slug,
        name: aig.name,
        type: aig.type,
        count: aig._count.mentorProfiles,
      })),
    );
  } catch (err) {
    next(err);
  }
};

const getAig = async (req, res, next) => {
  try {
    const aig = await prisma.aIG.findUnique({ where: { slug: req.params.slug } });
    if (!aig) return res.status(404).json({ error: "AIG not found" });
    res.json({ id: aig.slug, name: aig.name, type: aig.type });
  } catch (err) {
    next(err);
  }
};

const listMentors = async (req, res, next) => {
  try {
    const { aigSlug } = req.query;
    const now = new Date();
    const mentors = await prisma.mentorProfile.findMany({
      where: aigSlug ? { aig: { slug: aigSlug } } : undefined,
      include: {
        user: true,
        aig: true,
        slots: { where: { startTime: { gt: now } }, include: { capacity: true } },
      },
    });

    res.json(
      mentors.map((m) => ({
        id: m.slug,
        aigId: m.aig.slug,
        name: m.user.name,
        firm: m.firm,
        domain: m.domain,
        liveSlots: m.slots.filter((s) => !s.capacity || s.capacity.current < s.capacity.max).length,
      })),
    );
  } catch (err) {
    next(err);
  }
};

const getMentor = async (req, res, next) => {
  try {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { slug: req.params.slug },
      include: { user: true, aig: true },
    });
    if (!mentor) return res.status(404).json({ error: "Mentor not found" });
    res.json({
      id: mentor.slug,
      name: mentor.user.name,
      firm: mentor.firm,
      domain: mentor.domain,
      cohortId: mentor.cohortId,
      aig: { id: mentor.aig.slug, name: mentor.aig.name },
    });
  } catch (err) {
    next(err);
  }
};

const listSlots = async (req, res, next) => {
  try {
    const { mentorSlug } = req.query;
    if (!mentorSlug) return res.status(400).json({ error: "mentorSlug query param is required" });

    const mentor = await prisma.mentorProfile.findUnique({ where: { slug: mentorSlug } });
    if (!mentor) return res.status(404).json({ error: "Mentor not found" });

    const slots = await prisma.slot.findMany({
      where: { mentorProfileId: mentor.id },
      include: {
        capacity: true,
        bookings: { where: { status: "CONFIRMED" } },
      },
      orderBy: { startTime: "asc" },
    });

    res.json(
      slots.map((slot) => {
        const myBooking = slot.bookings.find((b) => b.studentUserId === req.user.sub);
        let status = "AVAILABLE";
        if (myBooking) status = "BOOKED_BY_ME";
        else if (slot.capacity && slot.capacity.current >= slot.capacity.max) status = "BOOKED_BY_OTHER";

        return {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          venue: slot.venue,
          status,
          ...(myBooking && { bookingId: myBooking.id, focus: myBooking.focus }),
        };
      }),
    );
  } catch (err) {
    next(err);
  }
};

const releaseSlots = async (req, res, next) => {
  try {
    const { startTime, endTime, slotDuration, venue, cohortOnly } = req.body;
    if (!startTime || !endTime || !slotDuration || !venue) {
      return res.status(400).json({ error: "startTime, endTime, slotDuration, and venue are required" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Number(slotDuration);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || duration <= 0) {
      return res.status(400).json({ error: "Invalid time range or slotDuration" });
    }
    if (start <= new Date()) {
      return res.status(400).json({ error: "Start time must be in the future" });
    }

    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const intervals = [];
    for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + duration * 60000)) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      if (slotEnd > end) break;
      intervals.push({ startTime: new Date(cursor), endTime: slotEnd });
    }
    if (intervals.length === 0) {
      return res.status(400).json({ error: "Time range too short for the given slot duration" });
    }

    const release = await prisma.$transaction(async (tx) => {
      const created = await tx.bookingRelease.create({
        data: {
          mentorProfileId: mentorProfile.id,
          startTime: start,
          endTime: end,
          slotDuration: duration,
          venue,
          cohortOnly: Boolean(cohortOnly),
        },
      });

      for (const interval of intervals) {
        const slot = await tx.slot.create({
          data: {
            releaseId: created.id,
            mentorProfileId: mentorProfile.id,
            startTime: interval.startTime,
            endTime: interval.endTime,
            venue,
          },
        });
        await tx.slotCapacity.create({ data: { slotId: slot.id, max: 1, current: 0 } });
      }

      await tx.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "SLOT_RELEASED",
          entity: "BookingRelease",
          entityId: created.id,
          meta: JSON.stringify({ slotsCreated: intervals.length }),
        },
      });

      return created;
    });

    const slots = await prisma.slot.findMany({ where: { releaseId: release.id }, include: { capacity: true } });
    res.status(201).json({ release, slots });
  } catch (err) {
    next(err);
  }
};

const deleteSlot = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: { bookings: true },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "Not your slot" });
    }
    if (slot.bookings.length > 0) {
      // Any booking row (even cancelled/attended) still references this slot via
      // foreign key — deleting it would either violate that constraint or destroy
      // booking history, so block it regardless of status.
      return res.status(409).json({ error: "Cannot delete a slot with existing booking history" });
    }

    await prisma.$transaction([
      prisma.slotCapacity.deleteMany({ where: { slotId: slot.id } }),
      prisma.slot.delete({ where: { id: slot.id } }),
      prisma.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "SLOT_DELETED",
          entity: "Slot",
          entityId: slot.id,
        },
      }),
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const getMentorCohort = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });
    if (!mentorProfile.cohortId) return res.status(404).json({ error: "No cohort assigned" });

    const cohort = await prisma.cohort.findUnique({
      where: { id: mentorProfile.cohortId },
      include: {
        studentProfiles: {
          include: { user: { include: { bookings: true } } },
        },
      },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });

    const members = cohort.studentProfiles.map((sp) => {
      const activeBookings = sp.user.bookings.filter((b) => b.status !== "CANCELLED");
      const attended = sp.user.bookings
        .filter((b) => b.status === "ATTENDED")
        .sort((a, b) => b.createdAt - a.createdAt);
      return {
        id: sp.id,
        name: sp.user.name,
        pgp: sp.pgpId,
        slotsTaken: activeBookings.length,
        lastReview: attended[0]?.createdAt ?? null,
      };
    });

    res.json({ id: cohort.id, label: cohort.label, members });
  } catch (err) {
    next(err);
  }
};

// ─── Mentor own slots + dashboard data ───────────────────────────────────────

const listMentorOwnSlots = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const fmtTime = (d) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    // Today's slots (we filter to those with confirmed bookings below)
    const slotsToday = await prisma.slot.findMany({
      where: { mentorProfileId: mentorProfile.id, startTime: { gte: todayStart, lt: todayEnd } },
      include: {
        bookings: {
          where: { status: "CONFIRMED" },
          include: { student: { select: { name: true, studentProfile: { select: { pgpId: true } } } } },
        },
      },
      orderBy: { startTime: "asc" },
    });

    const bookedSessions = slotsToday
      .filter((s) => s.bookings.length > 0)
      .map((s) => ({
        id: s.id,
        bookingId: s.bookings[0].id,
        time: fmtTime(s.startTime),
        venue: s.venue,
        student: {
          name: s.bookings[0].student?.name ?? "—",
          pgp: s.bookings[0].student?.studentProfile?.pgpId ?? "N/A",
          purpose: s.bookings[0].focus,
        },
      }));

    // Upcoming unbooked slots (for the live slot list)
    const upcomingSlots = await prisma.slot.findMany({
      where: { mentorProfileId: mentorProfile.id, startTime: { gte: now } },
      include: {
        bookings: { where: { status: "CONFIRMED" } },
        release: { select: { cohortOnly: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const availableSlots = upcomingSlots
      .filter((s) => s.bookings.length === 0)
      .map((s) => ({
        id: s.id,
        time: `${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`,
        venue: s.venue,
        cohortOnly: s.release?.cohortOnly ?? false,
      }));

    // Cohort aggregate stats
    let cohortStats = { totalMentees: 0, totalSlotsTaken: 0 };
    if (mentorProfile.cohortId) {
      const [menteeCount, bookingCount] = await Promise.all([
        prisma.studentProfile.count({ where: { cohortId: mentorProfile.cohortId } }),
        prisma.booking.count({
          where: {
            slot: { mentorProfileId: mentorProfile.id },
            status: { in: ["CONFIRMED", "ATTENDED"] },
          },
        }),
      ]);
      cohortStats = { totalMentees: menteeCount, totalSlotsTaken: bookingCount };
    }

    res.json({ bookedSessions, availableSlots, cohortStats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAigs,
  getAig,
  listMentors,
  getMentor,
  listSlots,
  listMentorOwnSlots,
  releaseSlots,
  deleteSlot,
  getMentorCohort,
};
