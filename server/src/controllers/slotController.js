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
      include: { bookings: { where: { status: "CONFIRMED" } } },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "Not your slot" });
    }
    if (slot.bookings.length > 0) {
      return res.status(409).json({ error: "Cannot delete a slot with an active booking" });
    }

    await prisma.$transaction([
      prisma.slotCapacity.deleteMany({ where: { slotId: slot.id } }),
      prisma.slot.delete({ where: { id: slot.id } }),
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

module.exports = {
  listAigs,
  getAig,
  listMentors,
  getMentor,
  listSlots,
  releaseSlots,
  deleteSlot,
  getMentorCohort,
};
