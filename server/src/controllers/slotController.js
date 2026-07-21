"use strict";

const prisma  = require("../lib/prisma");
const mailer  = require("../lib/mailer");
const { buildSessionEvent, buildGoogleCalendarLink, CALENDAR_ORGANIZER_EMAIL } = require("../lib/calendarInvite");

const listAigs = async (_req, res, next) => {
  try {
    const [aigs, totalNonAig, pgp2NoAigCount] = await Promise.all([
      prisma.aIG.findMany({
        include: { _count: { select: { mentorProfiles: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.mentorProfile.count({ where: { aigId: null } }),
      prisma.mentorProfile.count({ where: { aigId: null, mentorType: "PGP2_STUDENT_NO_AIG" } }),
    ]);
    const groups = aigs.map((aig) => ({
      id: aig.slug,
      name: aig.name,
      type: aig.type,
      count: aig._count.mentorProfiles,
    }));
    // Team Disha is a Committee, not an AIG (see schema's OrgCategory) — surface it
    // first regardless of alphabetical name order so it stays the lead entry.
    groups.sort((a, b) => (a.id === "disha" ? -1 : b.id === "disha" ? 1 : 0));
    // Mentors not attached to any AIG (independent/general mentors) were previously
    // invisible on the student dashboard's browse view — only findable via search.
    // Surface them as pseudo-groups alongside the real AIGs. Two distinct
    // independent populations share aigId=null — "Non Disha Mentors" (the
    // original population) and "PGP 2 Mentors" (added later, kept as its own
    // block) — split by mentorType, with anything not explicitly
    // PGP2_STUDENT_NO_AIG defaulting to the "Non Disha Mentors" bucket so an
    // unexpected mentorType still shows up somewhere rather than vanishing.
    const nonDishaCount = totalNonAig - pgp2NoAigCount;
    if (nonDishaCount > 0) {
      groups.push({ id: "none", name: "Non Disha Mentors", type: "Independent", count: nonDishaCount });
    }
    if (pgp2NoAigCount > 0) {
      groups.push({ id: "pgp2-no-aig", name: "PGP 2 Mentors", type: "Independent", count: pgp2NoAigCount });
    }
    res.json(groups);
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

    const where =
      aigSlug === "none"
        ? { aigId: null, mentorType: { not: "PGP2_STUDENT_NO_AIG" } }
        : aigSlug === "pgp2-no-aig"
        ? { aigId: null, mentorType: "PGP2_STUDENT_NO_AIG" }
        : aigSlug
        ? { aig: { slug: aigSlug } }
        : undefined;

    const mentors = await prisma.mentorProfile.findMany({
      where,
      include: {
        user: true,
        aig: true,
        slots: {
          // published: true — must match listSlots' definition of "visible to a
          // student" exactly, otherwise this count includes draft slots the
          // student can never actually see or book when they open the mentor's page.
          where: { startTime: { gt: now }, retired: false, published: true },
          include: { capacity: true, release: { select: { cohortOnly: true } } },
        },
      },
    });

    res.json(
      mentors.map((m) => ({
        id: m.slug,
        aigId: m.aig?.slug ?? null,
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
      aig: mentor.aig ? { id: mentor.aig.slug, name: mentor.aig.name } : null,
    });
  } catch (err) {
    next(err);
  }
};

const listSlots = async (req, res, next) => {
  try {
    const { mentorSlug } = req.query;
    if (!mentorSlug) return res.status(400).json({ error: "mentorSlug query param is required" });

    const mentor = await prisma.mentorProfile.findUnique({
      where: { slug: mentorSlug },
      include: { user: { select: { email: true } } },
    });
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
      where: { mentorProfileId: mentor.id, startTime: { gt: now }, published: true },
      include: {
        capacity: true,
        bookings: { where: { status: "CONFIRMED" } },
        release: { select: { cohortOnly: true } },
        waitlist: { where: { studentUserId: req.user.sub }, select: { id: true } },
      },
      orderBy: { startTime: "asc" },
    });

    res.json(
      slots
        // Cohort-restricted slots aren't just unbookable for non-members — they shouldn't
        // appear in their list at all, so filter them out before mapping to the response.
        .filter((slot) => !(slot.release?.cohortOnly ?? false) || isCohortMember)
        .map((slot) => {
          const myBooking = slot.bookings.find((b) => b.studentUserId === req.user.sub);
          const cohortOnly = slot.release?.cohortOnly ?? false;
          let status = "AVAILABLE";
          if (myBooking) status = "BOOKED_BY_ME";
          else if (slot.capacity && slot.capacity.current >= slot.capacity.max) status = "BOOKED_BY_OTHER";

          return {
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            venue: slot.venue,
            cohortOnly,
            status,
            delayMinutes: slot.delayMinutes ?? 0,
            onWaitlist: slot.waitlist.length > 0,
            // Only reveal the meeting link and mentor contact details once the student
            // has actually booked it — same gating as meetingLink, extended to phone/email
            // so Call/WhatsApp on the student side doesn't leak a mentor's personal number
            // to every student browsing, only to the one they've actually booked with.
            ...(myBooking && {
              bookingId: myBooking.id,
              focus: myBooking.focus,
              meetingLink: slot.meetingLink ?? null,
              mentorPhone: mentor.phone ?? null,
              mentorEmail: mentor.user.email,
            }),
          };
        }),
    );
  } catch (err) {
    next(err);
  }
};

const releaseSlots = async (req, res, next) => {
  try {
    const { startTime, endTime, slotDuration, venue, cohortOnly, publish } = req.body;
    // Trimmed the same way as setSlotMeetingLink/bulkSetMeetingLink, so a pasted
    // link with incidental leading/trailing whitespace isn't rejected here but
    // accepted there.
    const meetingLink = (req.body.meetingLink ?? "").trim();
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

      // Defaults to published (matches pre-existing behavior for mentors who don't
      // think about this) — pass publish:false to create as a draft instead.
      const published = publish !== false;
      for (const interval of intervals) {
        const slot = await tx.slot.create({
          data: {
            releaseId: created.id,
            mentorProfileId: mentorProfile.id,
            startTime: interval.startTime,
            endTime: interval.endTime,
            venue,
            meetingLink: meetingLink || null,
            published,
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
    // DB-enforced by the slot_no_overlap_per_mentor GiST exclusion constraint —
    // Prisma surfaces this as an untyped error, so match on the constraint name.
    if (err.message?.includes("slot_no_overlap_per_mentor")) {
      return res.status(409).json({ error: "This time range overlaps with one of your existing slots" });
    }
    next(err);
  }
};

// Every delete is a soft delete — the row always stays (retired: true, published:
// false), never removed from the DB. That's also required for slots with CANCELLED
// booking history: Booking.slotId is ON DELETE RESTRICT, so hard-deleting a slot a
// cancelled booking still points to would fail outright. Retiring instead keeps
// startTime/endTime intact, since the cancelled booking's own history display
// (student's "My Sessions", mentor's "Cancelled Sessions", admin pages, CSV exports)
// reads the original scheduled time through this same row and must stay accurate.
// A slot with a live CONFIRMED booking can also be deleted — that booking is
// auto-cancelled (cancelledBy: MENTOR) and the student is emailed a cancellation
// notice, same pattern as reassignBooking's outgoing-student notice. A slot whose
// session already ran (ATTENDED/NO_SHOW) is left alone — nothing to cancel, and the
// record shouldn't be pulled out of the mentor's own history views.
const deleteSlot = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          where: { status: { not: "CANCELLED" } },
          include: { student: { select: { name: true, email: true } } },
        },
      },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) {
      return res.status(403).json({ error: "Not your slot" });
    }

    const resolvedBookings = slot.bookings.filter((b) => b.status !== "CONFIRMED");
    if (resolvedBookings.length > 0) {
      return res.status(409).json({ error: "Cannot delete a slot whose session already ran" });
    }
    const activeBookings = slot.bookings; // remaining ones are all CONFIRMED

    const now = new Date();
    const [updatedSlot] = await prisma.$transaction([
      prisma.slot.update({
        where: { id: slot.id },
        data: {
          retired: true,
          published: false,
          ...(activeBookings.length > 0 && { icsSequence: { increment: 1 } }),
        },
      }),
      ...activeBookings.map((b) =>
        prisma.booking.update({
          where: { id: b.id },
          data: { status: "CANCELLED", cancelledBy: "MENTOR", cancelledAt: now },
        }),
      ),
      prisma.auditEvent.create({
        data: {
          userId: req.user.sub,
          action: "SLOT_RETIRED",
          entity: "Slot",
          entityId: slot.id,
          ...(activeBookings.length > 0 && {
            meta: JSON.stringify({ cancelledBookings: activeBookings.length }),
          }),
        },
      }),
    ]);

    if (activeBookings.length > 0) {
      (async () => {
        const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        const mentorName = mentorProfile.user?.name ?? "your mentor";
        const date = fmtDate(slot.startTime);
        const time = fmtTime(slot.startTime);

        for (const b of activeBookings) {
          if (!b.student?.email) continue;
          const studentName = b.student.name ?? b.student.email;
          const icsContent = buildSessionEvent({
            uid: b.id,
            sequence: updatedSlot.icsSequence,
            method: "CANCEL",
            status: "CANCELLED",
            startTime: slot.startTime,
            endTime: slot.endTime,
            summary: `CV Review: ${studentName} × ${mentorName}`,
            description: "This session was cancelled via Parthsaarthi.",
            location: slot.venue,
            organizerEmail: CALENDAR_ORGANIZER_EMAIL,
            organizerName: "Parthsaarthi",
            attendees: [{ email: b.student.email, name: studentName }],
          });
          mailer.sendSlotDeletedToStudent({
            studentEmail: b.student.email,
            studentName,
            mentorName,
            date,
            time,
            icsContent,
          }).catch((e) => console.error("[mailer] slot deleted notice:", e.message));
        }
      })().catch((e) => console.error("[mailer] slot deleted notification:", e.message));
    }

    res.status(200).json({ id: slot.id, retired: true, cancelledBookings: activeBookings.length });
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

    // All slots with a CONFIRMED booking — no endTime bound, so a session whose
    // time has passed without attendance being marked stays visible here instead
    // of silently disappearing with no way to ever mark it (it naturally drops out
    // once the mentor marks ATTENDED/NO_SHOW, since it's no longer CONFIRMED).
    const upcomingBooked = await prisma.slot.findMany({
      where: {
        mentorProfileId: mentorProfile.id,
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

    const bookedAndOngoing = upcomingBooked.map((s) => ({
      id:           s.id,
      bookingId:    s.bookings[0].id,
      startTime:    s.startTime,
      endTime:      s.endTime,
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

    // Split by whether the session has already started — surfaced as separate
    // "Ongoing" / "Upcoming" sections on the mentor dashboard.
    const ongoingSessions = bookedAndOngoing.filter((s) => new Date(s.startTime) <= now);
    const bookedSessions  = bookedAndOngoing.filter((s) => new Date(s.startTime) > now);

    // Upcoming unbooked slots (for the live slot list)
    // Include any non-CANCELLED booking so used slots (ATTENDED/NO_SHOW) are excluded.
    const upcomingSlots = await prisma.slot.findMany({
      where: { mentorProfileId: mentorProfile.id, startTime: { gte: now }, retired: false },
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
        published: s.published,
      }));

    // Slots that started (or fully passed) with nobody having booked them — once
    // startTime is in the past they drop out of every booking-facing list (students
    // can no longer book, availableSlots above only looks forward) and previously
    // just vanished with no way for the mentor to see or clean them up. Surfaced
    // here instead, capped like cancelledBookings/historyBookings below.
    const expired = await prisma.slot.findMany({
      where: {
        mentorProfileId: mentorProfile.id,
        startTime: { lt: now },
        bookings: { none: { status: { not: "CANCELLED" } } },
        retired: false, // once retired via Delete, it's fully archived — drop off this list
      },
      include: {
        release: { select: { cohortOnly: true } },
        bookings: { select: { id: true } },
      },
      orderBy: { startTime: "desc" },
      take: 50,
    });
    const expiredSlots = expired.map((s) => ({
      id: s.id,
      time: fmtSlotTime(s.startTime, s.endTime),
      venue: s.venue,
      cohortOnly: s.release?.cohortOnly ?? false,
      // Distinguishes "nobody ever booked this" (Delete removes it outright) from
      // "someone booked it and then cancelled" (Delete instead retires it — see
      // deleteSlot) — both use the same Delete button, this is just context.
      reason: s.bookings.length > 0 ? "Cancelled" : "Unbooked",
    }));

    // Bookings the mentor's students cancelled — surfaced here so the mentor can
    // review each one and optionally apply a strike (the only way a cancellation
    // now results in a strike; see bookingController.applyManualStrike).
    const cancelledBookings = await prisma.booking.findMany({
      where: { mentorProfileId: mentorProfile.id, status: "CANCELLED", cancelledBy: "STUDENT" },
      include: {
        slot: { select: { startTime: true, endTime: true, venue: true } },
        student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } },
      },
      orderBy: { cancelledAt: "desc" },
      take: 50,
    });
    const strikedBookingIds = new Set(
      (await prisma.studentWarning.findMany({
        where: { bookingId: { in: cancelledBookings.map((b) => b.id) }, type: "STRIKE" },
        select: { bookingId: true },
      })).map((w) => w.bookingId),
    );
    const cancelledSessions = cancelledBookings.map((b) => ({
      bookingId:   b.id,
      startTime:   b.slot.startTime,
      endTime:     b.slot.endTime,
      date:        new Date(b.slot.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time:        fmtTime(b.slot.startTime),
      venue:       b.slot.venue,
      cancelledAt: b.cancelledAt,
      hasStrike:   strikedBookingIds.has(b.id),
      student: {
        name:  b.student?.name ?? "—",
        email: b.student?.email ?? null,
        pgp:   b.student?.studentProfile?.pgpId ?? "N/A",
      },
    }));

    // Total count for the History section's badge — the rows themselves are
    // fetched separately (paginated) via getMentorHistory below.
    const historyCount = await prisma.booking.count({
      where: { mentorProfileId: mentorProfile.id, status: { in: ["ATTENDED", "NO_SHOW"] } },
    });

    // Cohort aggregate stats
    let cohortStats = { totalMentees: 0, totalSlotsTaken: 0 };
    if (mentorProfile.cohortId) {
      const [menteeCount, bookingCount] = await Promise.all([
        prisma.studentProfile.count({ where: { cohortId: mentorProfile.cohortId } }),
        // "Taken" means the slot was claimed, whether or not the mentee actually
        // showed — same status set as the per-mentee count on the Cohort Tracker
        // page (getMentorCohort's activeBookings), so the two screens' numbers
        // reconcile. A cancelled booking freed the slot back up, so that's the
        // one status excluded.
        prisma.booking.count({
          where: {
            slot: { mentorProfileId: mentorProfile.id },
            status: { not: "CANCELLED" },
          },
        }),
      ]);
      cohortStats = { totalMentees: menteeCount, totalSlotsTaken: bookingCount };
    }

    res.json({ bookedSessions, ongoingSessions, availableSlots, expiredSlots, cancelledSessions, historyCount, cohortStats });
  } catch (err) {
    next(err);
  }
};

// Past sessions the mentor has already marked ATTENDED or NO_SHOW — paginated
// (10/page) since this list only grows over time and a mentor with a long
// history shouldn't have to load it all at once.
const getMentorHistory = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const pageSize = 10;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const where = { mentorProfileId: mentorProfile.id, status: { in: ["ATTENDED", "NO_SHOW"] } };

    const [total, historyBookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          slot: { select: { startTime: true, endTime: true, venue: true } },
          student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } },
        },
        orderBy: { slot: { startTime: "desc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const fmtTime = (d) =>
      new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const historySessions = historyBookings.map((b) => ({
      bookingId: b.id,
      startTime: b.slot.startTime,
      endTime:   b.slot.endTime,
      date:      new Date(b.slot.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time:      fmtTime(b.slot.startTime),
      venue:     b.slot.venue,
      status:    b.status,
      focus:     b.focus,
      student: {
        name:  b.student?.name ?? "—",
        email: b.student?.email ?? null,
        pgp:   b.student?.studentProfile?.pgpId ?? "N/A",
      },
    }));

    res.json({
      historySessions,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    next(err);
  }
};

// Total hours of this mentor's slots scheduled (by session startTime, not creation
// date) within [from, to] — lets a mentor see how many mentoring hours they've put
// on the calendar for a given window, since slot count alone is misleading when
// slots vary in duration.
const getSlotHoursReleased = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid from/to date" });
    }
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(0, 0, 0, 0);
    toDate.setDate(toDate.getDate() + 1); // inclusive of the whole "to" day

    const slots = await prisma.slot.findMany({
      where: { mentorProfileId: mentorProfile.id, startTime: { gte: fromDate, lt: toDate }, retired: false },
      select: { startTime: true, endTime: true },
    });
    const hours = slots.reduce((sum, s) => sum + (s.endTime - s.startTime) / 3600000, 0);

    res.json({ hours: +hours.toFixed(1), slotCount: slots.length });
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

    // Email every student with a CONFIRMED booking on this slot in one combined
    // message (all students in To:, mentor in Cc:) instead of one email each.
    if (delay > 0) {
      const bookedSlot = await prisma.slot.findUnique({
        where:   { id: slot.id },
        include: {
          mentorProfile: { include: { user: { select: { name: true, email: true } } } },
          bookings: {
            where:   { status: "CONFIRMED" },
            include: { student: { select: { name: true, email: true } } },
          },
        },
      });
      const mentorName  = bookedSlot?.mentorProfile?.user?.name ?? "Your mentor";
      const mentorEmail = bookedSlot?.mentorProfile?.user?.email ?? null;
      const fmtDate = (d) =>
        new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) =>
        new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      const students = (bookedSlot?.bookings ?? [])
        .filter((b) => b.student?.email)
        .map((b) => ({ name: b.student.name ?? b.student.email, email: b.student.email }));

      if (students.length > 0) {
        mailer.sendDelayNotification({
          students,
          mentorName,
          mentorEmail,
          date:         fmtDate(slot.startTime),
          time:         fmtTime(slot.startTime),
          venue:        slot.venue,
          delayMinutes: delay,
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

// Lets a mentor change an *unbooked* slot's venue (e.g. Library → GMeet) before
// anyone's claimed it — no booking to notify, so this is a plain field update,
// unlike setSlotReschedule's booked-slot path which also emails the student.
const setSlotVenue = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const venue = String(req.body.venue ?? "").trim();
    if (!venue) return res.status(400).json({ error: "venue is required" });
    const meetingLink = (req.body.meetingLink ?? "").trim();
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return res.status(400).json({ error: "meetingLink must be a valid URL" });
    }

    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: { bookings: { where: { status: { not: "CANCELLED" } } } },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your slot" });
    if (slot.bookings.length > 0) {
      return res.status(409).json({ error: "This slot already has a booking — use Reschedule to change its venue instead" });
    }

    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data:  { venue, meetingLink: meetingLink || null },
    });

    res.json({ id: updated.id, venue: updated.venue, meetingLink: updated.meetingLink });
  } catch (err) {
    next(err);
  }
};

// Mentor-initiated time (and, optionally, venue) shift of an already-booked
// session — same booking record, same student, no penalty either direction.
// venue/meetingLink let a mentor convert e.g. "Library (In-Person)" to
// "GMeet (Online)" in the same step as moving the time; both are optional and
// default to the slot's current values. Rescheduling an *unbooked* slot isn't
// supported here (just delete + recreate it instead, or use setSlotVenue if
// only the venue needs to change).
const setSlotReschedule = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: req.user.sub },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const newStart = new Date(req.body.startTime);
    const newEnd   = new Date(req.body.endTime);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime()) || newEnd <= newStart) {
      return res.status(400).json({ error: "Invalid time range" });
    }
    if (newStart <= new Date()) {
      return res.status(400).json({ error: "New start time must be in the future" });
    }
    const venue = req.body.venue !== undefined ? String(req.body.venue).trim() : undefined;
    if (venue !== undefined && !venue) return res.status(400).json({ error: "venue cannot be blank" });
    const meetingLink = req.body.meetingLink !== undefined ? String(req.body.meetingLink).trim() : undefined;
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return res.status(400).json({ error: "meetingLink must be a valid URL" });
    }

    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          where: { status: "CONFIRMED" },
          include: { student: { select: { name: true, email: true } } },
        },
      },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.mentorProfileId !== mentorProfile.id) return res.status(403).json({ error: "Not your slot" });
    const booking = slot.bookings[0];
    if (!booking) return res.status(400).json({ error: "This slot has no active booking to reschedule — delete and recreate it instead" });

    const oldStart = slot.startTime;
    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data:  {
        startTime: newStart,
        endTime: newEnd,
        icsSequence: { increment: 1 },
        ...(venue !== undefined && { venue }),
        ...(meetingLink !== undefined && { meetingLink: meetingLink || null }),
      },
    });

    // Notify both parties (non-blocking) — mentor's own calendar entry needs the
    // time pushed to it too, not just the student's.
    (async () => {
      const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      const mentorName  = mentorProfile.user?.name ?? "your mentor";
      const studentName = booking.student?.name ?? booking.student?.email ?? "your mentee";

      const icsContent = buildSessionEvent({
        uid: booking.id,
        sequence: updated.icsSequence,
        method: "REQUEST",
        status: "CONFIRMED",
        startTime: updated.startTime,
        endTime: updated.endTime,
        summary: `CV Review: ${studentName} × ${mentorName}`,
        description: "Rescheduled session via Parthsaarthi.",
        location: updated.venue,
        meetingLink: updated.meetingLink ?? null,
        organizerEmail: CALENDAR_ORGANIZER_EMAIL,
        organizerName: "Parthsaarthi",
        attendees: [
          ...(booking.student?.email ? [{ email: booking.student.email, name: studentName }] : []),
          ...(mentorProfile.user?.email ? [{ email: mentorProfile.user.email, name: mentorName }] : []),
        ],
      });
      const calendarLink = buildGoogleCalendarLink({
        summary: `CV Review: ${studentName} × ${mentorName}`,
        description: "Rescheduled session via Parthsaarthi.",
        location: updated.venue,
        startTime: updated.startTime,
        endTime: updated.endTime,
      });

      const shared = {
        oldDate: fmtDate(oldStart), oldTime: fmtTime(oldStart),
        newDate: fmtDate(updated.startTime), newTime: fmtTime(updated.startTime),
        venue: updated.venue, meetingLink: updated.meetingLink ?? null, icsContent, calendarLink,
      };

      if (booking.student?.email) {
        mailer.sendRescheduleNotification({
          to: booking.student.email, recipientName: studentName, otherPartyName: mentorName, ...shared,
        }).catch((e) => console.error("[mailer] reschedule to student:", e.message));
      }
      if (mentorProfile.user?.email) {
        mailer.sendRescheduleNotification({
          to: mentorProfile.user.email, recipientName: mentorName, otherPartyName: studentName, ...shared,
        }).catch((e) => console.error("[mailer] reschedule to mentor:", e.message));
      }
    })().catch((e) => console.error("[mailer] reschedule notification:", e.message));

    res.json({ id: updated.id, startTime: updated.startTime, endTime: updated.endTime });
  } catch (err) {
    // DB-enforced by the slot_no_overlap_per_mentor GiST exclusion constraint —
    // Prisma surfaces this as an untyped error, so match on the constraint name.
    if (err.message?.includes("slot_no_overlap_per_mentor")) {
      return res.status(409).json({ error: "The new time overlaps with one of your existing slots" });
    }
    next(err);
  }
};

// ── Bulk slot actions ──────────────────────────────────────────────────────────
// Same ownership + eligibility rule as the single-slot deleteSlot above (soft
// delete, never removed from the DB), just applied across a list. Per-slot, not
// all-or-nothing — one ineligible slot in the batch shouldn't block deleting the
// rest. Unlike the single-slot path, this one still skips any slot with booking
// history (of any status) rather than auto-cancelling — a bulk action isn't the
// place to silently cancel a live student booking.

const bulkDeleteSlots = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slotIds = Array.isArray(req.body.slotIds) ? req.body.slotIds : [];
    if (slotIds.length === 0) return res.status(400).json({ error: "slotIds must be a non-empty array" });

    const slots = await prisma.slot.findMany({
      where: { id: { in: slotIds } },
      include: { bookings: true },
    });

    const deletable = slots.filter((s) => s.mentorProfileId === mentorProfile.id && s.bookings.length === 0);
    const skipped = slotIds.filter((id) => !deletable.some((s) => s.id === id));

    if (deletable.length > 0) {
      await prisma.$transaction([
        prisma.slot.updateMany({
          where: { id: { in: deletable.map((s) => s.id) } },
          data: { retired: true, published: false },
        }),
        prisma.auditEvent.create({
          data: {
            userId: req.user.sub,
            action: "SLOT_RETIRED",
            entity: "Slot",
            meta: JSON.stringify({ bulk: true, count: deletable.length }),
          },
        }),
      ]);
    }

    res.json({ deleted: deletable.length, skipped });
  } catch (err) {
    next(err);
  }
};

const bulkSetMeetingLink = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slotIds = Array.isArray(req.body.slotIds) ? req.body.slotIds : [];
    if (slotIds.length === 0) return res.status(400).json({ error: "slotIds must be a non-empty array" });

    const meetingLink = (req.body.meetingLink ?? "").trim();
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return res.status(400).json({ error: "meetingLink must be a valid URL" });
    }

    const result = await prisma.slot.updateMany({
      where: { id: { in: slotIds }, mentorProfileId: mentorProfile.id },
      data: { meetingLink: meetingLink || null },
    });

    res.json({ updated: result.count, skipped: slotIds.length - result.count });
  } catch (err) {
    next(err);
  }
};

const bulkSetPublished = async (req, res, next) => {
  try {
    const mentorProfile = await prisma.mentorProfile.findUnique({ where: { userId: req.user.sub } });
    if (!mentorProfile) return res.status(403).json({ error: "No mentor profile for this account" });

    const slotIds = Array.isArray(req.body.slotIds) ? req.body.slotIds : [];
    if (slotIds.length === 0) return res.status(400).json({ error: "slotIds must be a non-empty array" });

    const result = await prisma.slot.updateMany({
      where: { id: { in: slotIds }, mentorProfileId: mentorProfile.id },
      data: { published: true },
    });

    res.json({ published: result.count, skipped: slotIds.length - result.count });
  } catch (err) {
    next(err);
  }
};

// ── Waitlist (notify-only — never auto-books) ──────────────────────────────────

const joinWaitlist = async (req, res, next) => {
  try {
    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: { capacity: true, release: { select: { cohortOnly: true } }, mentorProfile: true },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (!slot.capacity || slot.capacity.current < slot.capacity.max) {
      return res.status(400).json({ error: "This slot isn't full — just book it directly" });
    }
    if (slot.release?.cohortOnly) {
      const sp = await prisma.studentProfile.findUnique({ where: { userId: req.user.sub } });
      if (!sp || sp.cohortId !== slot.mentorProfile.cohortId) {
        return res.status(403).json({ error: "This slot is reserved for the mentor's cohort" });
      }
    }

    await prisma.slotWaitlist.upsert({
      where: { slotId_studentUserId: { slotId: slot.id, studentUserId: req.user.sub } },
      update: {},
      create: { slotId: slot.id, studentUserId: req.user.sub },
    });

    res.status(201).json({ onWaitlist: true });
  } catch (err) {
    next(err);
  }
};

const leaveWaitlist = async (req, res, next) => {
  try {
    await prisma.slotWaitlist.deleteMany({
      where: { slotId: req.params.id, studentUserId: req.user.sub },
    });
    res.json({ onWaitlist: false });
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
  getMentorHistory,
  getSlotHoursReleased,
  releaseSlots,
  deleteSlot,
  setSlotDelay,
  setSlotMeetingLink,
  setSlotVenue,
  setSlotReschedule,
  bulkDeleteSlots,
  bulkSetMeetingLink,
  bulkSetPublished,
  joinWaitlist,
  leaveWaitlist,
  getMentorCohort,
};
