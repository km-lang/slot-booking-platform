"use strict";

const prisma  = require("../lib/prisma");
const mailer  = require("../lib/mailer");

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

    // Only students booking for themselves need cohort eligibility factored into the count —
    // without this, a student could see "5 Slots" on a mentor and find most are cohort-only
    // slots they're not actually eligible to book.
    let studentCohortId = null;
    if (req.user.role === "STUDENT") {
      const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } });
      studentCohortId = sp?.cohortId ?? null;
    }

    const mentors = await prisma.mentorProfile.findMany({
      where: aigSlug ? { aig: { slug: aigSlug } } : undefined,
      include: {
        user: true,
        aig: true,
        slots: {
          where: { startTime: { gt: now } },
          include: { capacity: true, release: { select: { cohortOnly: true } } },
        },
      },
    });

    res.json(
      mentors.map((m) => ({
        id: m.slug,
        aigId: m.aig.slug,
        name: m.user.name,
        firm: m.firm,
        domain: m.domain,
        liveSlots: m.slots.filter((s) => {
          const open = !s.capacity || s.capacity.current < s.capacity.max;
          if (!open) return false;
          const restricted = s.release?.cohortOnly && (studentCohortId === null || studentCohortId !== m.cohortId);
          return !restricted;
        }).length,
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

    // Eligibility for cohort-only slots — surfaced as a distinct status below so the UI can
    // show ineligible slots as restricted up front, instead of inviting a "Book" tap that
    // would only fail with a 403 once the student reaches the confirm step.
    let studentCohortId = null;
    if (req.user.role === "STUDENT") {
      const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } });
      studentCohortId = sp?.cohortId ?? null;
    }
    const isCohortMember = studentCohortId !== null && studentCohortId === mentor.cohortId;

    const now = new Date();
    const slots = await prisma.slot.findMany({
      where: { mentorProfileId: mentor.id, startTime: { gt: now } },
      include: {
        capacity: true,
        bookings: { where: { status: "CONFIRMED" } },
        release: { select: { cohortOnly: true } },
      },
      orderBy: { startTime: "asc" },
    });

    res.json(
      slots.map((slot) => {
        const myBooking = slot.bookings.find((b) => b.studentUserId === req.user.sub);
        const cohortOnly = slot.release?.cohortOnly ?? false;
        let status = "AVAILABLE";
        if (myBooking) status = "BOOKED_BY_ME";
        else if (slot.capacity && slot.capacity.current >= slot.capacity.max) status = "BOOKED_BY_OTHER";
        else if (cohortOnly && !isCohortMember) status = "COHORT_RESTRICTED";

        return {
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          venue: slot.venue,
          cohortOnly,
          status,
          delayMinutes: slot.delayMinutes ?? 0,
          // Only reveal the meeting link once the student has actually booked it.
          ...(myBooking && { bookingId: myBooking.id, focus: myBooking.focus, meetingLink: slot.meetingLink ?? null }),
        };
      }),
    );
  } catch (err) {
    next(err);
  }
};

const releaseSlots = async (req, res, next) => {
  try {
    const { startTime, endTime, slotDuration, venue, cohortOnly, meetingLink } = req.body;
    if (!startTime || !endTime || !slotDuration || !venue) {
      return res.status(400).json({ error: "startTime, endTime, slotDuration, and venue are required" });
    }
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return res.status(400).json({ error: "meetingLink must be a valid URL" });
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
          meetingLink: meetingLink || null,
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
            meetingLink: meetingLink || null,
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

    const now = new Date();
    const cohort = await prisma.cohort.findUnique({
      where: { id: mentorProfile.cohortId },
      include: {
        studentProfiles: {
          include: {
            user: {
              include: {
                bookings: true,
                bans: {
                  where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                },
              },
            },
          },
        },
      },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });

    const fmtDate = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "—";

    const members = cohort.studentProfiles.map((sp) => {
      const activeBookings = sp.user.bookings.filter((b) => b.status !== "CANCELLED");
      const attended = sp.user.bookings
        .filter((b) => b.status === "ATTENDED")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const isBanned = sp.user.bans.length > 0;
      const isReady = attended.length > 0;
      const status = isBanned ? "Action Needed" : isReady ? "Reviewed" : "In Progress";
      return {
        id: sp.id,
        name: sp.user.name,
        pgp: sp.pgpId,
        email: sp.user.email,
        slotsTaken: activeBookings.length,
        lastReview: fmtDate(attended[0]?.createdAt),
        isBanned,
        status,
      };
    });

    res.json({
      cohort: { id: cohort.id, label: cohort.label, memberCount: members.length },
      members,
    });
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

    const fmtTime = (d) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const fmtSlotTime = (start, end) => {
      const date = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `${date}, ${fmtTime(start)} – ${fmtTime(end)}`;
    };

    // All upcoming slots with confirmed bookings (full schedule view)
    const upcomingBooked = await prisma.slot.findMany({
      where: {
        mentorProfileId: mentorProfile.id,
        startTime: { gte: now },
        bookings: { some: { status: "CONFIRMED" } },
      },
      include: {
        bookings: {
          where: { status: "CONFIRMED" },
          include: { student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } } },
        },
      },
      orderBy: { startTime: "asc" },
    });

    const bookedSessions = upcomingBooked.map((s) => ({
      id:           s.id,
      bookingId:    s.bookings[0].id,
      date:         new Date(s.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time:         fmtTime(s.startTime),
      venue:        s.venue,
      delayMinutes: s.delayMinutes,
      meetingLink:  s.meetingLink ?? null,
      student: {
        name:    s.bookings[0].student?.name ?? "—",
        email:   s.bookings[0].student?.email ?? null,
        pgp:     s.bookings[0].student?.studentProfile?.pgpId ?? "N/A",
        purpose: s.bookings[0].focus,
      },
    }));

    // Upcoming unbooked slots (for the live slot list)
    // Include any non-CANCELLED booking so used slots (ATTENDED/NO_SHOW) are excluded.
    const upcomingSlots = await prisma.slot.findMany({
      where: { mentorProfileId: mentorProfile.id, startTime: { gte: now } },
      include: {
        bookings: { where: { status: { not: "CANCELLED" } } },
        release: { select: { cohortOnly: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const availableSlots = upcomingSlots
      .filter((s) => s.bookings.length === 0)
      .map((s) => ({
        id: s.id,
        time: fmtSlotTime(s.startTime, s.endTime),
        venue: s.venue,
        cohortOnly: s.release?.cohortOnly ?? false,
        meetingLink: s.meetingLink ?? null,
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

const setSlotDelay = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const delay = Number(req.body.delayMinutes);
    if (!Number.isInteger(delay) || delay < 0 || delay > 120) {
      return res.status(400).json({ error: "delayMinutes must be an integer between 0 and 120" });
    }

    const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your slot" });

    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data:  { delayMinutes: delay },
    });

    // Email all students with a CONFIRMED booking on this slot
    if (delay > 0) {
      const bookedSlot = await prisma.slot.findUnique({
        where:   { id: slot.id },
        include: {
          mentorProfile: { include: { user: { select: { name: true } } } },
          bookings: {
            where:   { status: "CONFIRMED" },
            include: { student: { select: { name: true, email: true } } },
          },
        },
      });
      const mentorName = bookedSlot?.mentorProfile?.user?.name ?? "Your mentor";
      const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      for (const booking of (bookedSlot?.bookings ?? [])) {
        if (!booking.student?.email) continue;
        mailer.sendDelayNotification({
          studentEmail:  booking.student.email,
          studentName:   booking.student.name ?? booking.student.email,
          mentorName,
          date:          fmtDate(slot.startTime),
          time:          fmtTime(slot.startTime),
          venue:         slot.venue,
          delayMinutes:  delay,
        }).catch(() => {});
      }
    }

    res.json({ id: updated.id, delayMinutes: updated.delayMinutes });
  } catch (err) {
    next(err);
  }
};

// Lets a mentor add/edit a slot's meeting link after the slot was already created
// ("or later somewhere", per the original ask) — e.g. filling it in right before
// a session if it wasn't set at release time.
const setSlotMeetingLink = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const meetingLink = (req.body.meetingLink ?? "").trim();
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return res.status(400).json({ error: "meetingLink must be a valid URL" });
    }

    const slot = await prisma.slot.findUnique({ where: { id: req.params.id } });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your slot" });

    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data:  { meetingLink: meetingLink || null },
    });

    res.json({ id: updated.id, meetingLink: updated.meetingLink });
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
  setSlotDelay,
  setSlotMeetingLink,
  getMentorCohort,
};
