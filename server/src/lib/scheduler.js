"use strict";

const cron   = require("node-cron");
const prisma = require("./prisma");
const {
  sendStudentReminder,
  sendMentorReminder,
  sendAigDigest,
} = require("./mailer");

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

// ── 30-minute session reminders ────────────────────────────────────────────────
// Runs every minute. Finds slots starting in 28–32 minutes with a CONFIRMED
// booking that haven't had a REMINDER_SENT audit event yet, then emails both
// the student and mentor.

async function sendSessionReminders() {
  try {
    const now     = new Date();
    const windowStart = new Date(now.getTime() + 28 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 32 * 60 * 1000);

    const slots = await prisma.slot.findMany({
      where: {
        startTime: { gte: windowStart, lte: windowEnd },
        bookings:  { some: { status: "CONFIRMED" } },
      },
      include: {
        mentorProfile: { include: { user: { select: { name: true, email: true } } } },
        bookings: {
          where: { status: "CONFIRMED" },
          include: { student: { select: { name: true, email: true, studentProfile: { select: { pgpId: true } } } } },
        },
      },
    });

    for (const slot of slots) {
      try {
        // Check dedup via AuditEvent
        const already = await prisma.auditEvent.findFirst({
          where: { action: "REMINDER_SENT", entityId: slot.id },
        });
        if (already) continue;

        const booking = slot.bookings[0];
        if (!booking) continue;

        const student     = booking.student;
        const mentor      = slot.mentorProfile.user;
        const mentorFirm  = slot.mentorProfile.firm;
        const date        = fmtDate(slot.startTime);
        const time        = fmtTime(slot.startTime);

        // allSettled (not all) so one recipient's failure doesn't stop the other's
        // send from being attempted, and doesn't leave the slot unmarked — an
        // unmarked slot would retry every minute for the rest of its 4-minute
        // eligibility window, re-sending to whichever recipient already succeeded.
        const [studentResult, mentorResult] = await Promise.allSettled([
          sendStudentReminder({
            studentEmail: student.email,
            studentName:  student.name ?? student.email,
            mentorName:   mentor.name ?? mentor.email,
            firm:         mentorFirm,
            date, time,
            venue:  slot.venue,
            focus:  booking.focus,
          }),
          sendMentorReminder({
            mentorEmail:  mentor.email,
            mentorName:   mentor.name ?? mentor.email,
            studentName:  student.name ?? student.email,
            pgpId:        student.studentProfile?.pgpId ?? "N/A",
            date, time,
            venue:  slot.venue,
            focus:  booking.focus,
          }),
        ]);
        if (studentResult.status === "rejected") {
          console.error(`[Scheduler] Reminder email to student ${student.email} failed for slot ${slot.id}:`, studentResult.reason?.message ?? studentResult.reason);
        }
        if (mentorResult.status === "rejected") {
          console.error(`[Scheduler] Reminder email to mentor ${mentor.email} failed for slot ${slot.id}:`, mentorResult.reason?.message ?? mentorResult.reason);
        }

        // Mark as attempted so cron doesn't retry (failures above are logged, not silent)
        await prisma.auditEvent.create({
          data: { action: "REMINDER_SENT", entity: "Slot", entityId: slot.id },
        });
      } catch (err) {
        console.error(`[Scheduler] Reminder error for slot ${slot.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Reminder error:", err.message);
  }
}

// ── Daily AIG admin digest ─────────────────────────────────────────────────────
// Runs at 08:00 every morning. Emails each AIG admin a summary of at-risk
// students (no ATTENDED booking and not banned) in their AIG.

async function sendDailyDigests() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: "cv_freeze_deadline" } });
    const deadline = config?.value
      ? new Date(config.value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;

    // AIG admins from the whitelist
    const aigAdmins = await prisma.accessWhitelist.findMany({
      where: { role: "AIGs" },
      include: { aig: { select: { id: true, name: true } } },
    });

    for (const admin of aigAdmins) {
      if (!admin.aig) continue;

      // Per-admin try/catch so one AIG's failure (e.g. a bad email address) doesn't
      // abort the digest for every other AIG admin for the day.
      try {
        // Fetch user record for admin's email
        const adminUser = await prisma.user.findUnique({ where: { email: admin.email }, select: { name: true } });

        // Students in this AIG's cohorts with no ATTENDED booking
        const mentors = await prisma.mentorProfile.findMany({
          where: { aigId: admin.aig.id },
          include: {
            cohort: {
              include: {
                studentProfiles: {
                  include: {
                    user: {
                      select: {
                        name: true,
                        email: true,
                        bookings: { where: { status: "ATTENDED" } },
                        bans:     { where: { liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const atRisk = [];
        const seen   = new Set();
        for (const mentor of mentors) {
          for (const sp of (mentor.cohort?.studentProfiles ?? [])) {
            if (seen.has(sp.userId)) continue;
            seen.add(sp.userId);
            const u = sp.user;
            const isBanned      = u.bans.length > 0;
            const hasAttended   = u.bookings.length > 0;
            if (!hasAttended || isBanned) {
              atRisk.push({
                name:        u.name ?? u.email,
                cohortLabel: mentor.cohort?.label ?? "—",
                reason:      isBanned ? "Banned" : "No review yet",
              });
            }
          }
        }

        if (atRisk.length === 0) continue;

        await sendAigDigest({
          adminEmail: admin.email,
          adminName:  adminUser?.name ?? admin.email,
          aigName:    admin.aig.name,
          atRiskCount: atRisk.length,
          deadline,
          students:   atRisk,
        });
      } catch (err) {
        console.error(`[Scheduler] Daily digest error for AIG admin ${admin.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Daily digest error:", err.message);
  }
}

// ── Start all jobs ─────────────────────────────────────────────────────────────

function startScheduler() {
  // Every minute — check for 30-min-away sessions
  cron.schedule("* * * * *", sendSessionReminders);

  // Every day at 08:00 IST
  cron.schedule("0 8 * * *", sendDailyDigests, { timezone: "Asia/Kolkata" });

  console.log("Scheduler started (reminders every minute, digest at 08:00 IST)");
}

module.exports = { startScheduler };
