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

      await Promise.all([
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

      // Mark as sent so cron doesn't fire again for this slot
      await prisma.auditEvent.create({
        data: { action: "REMINDER_SENT", entity: "Slot", entityId: slot.id },
      });
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
