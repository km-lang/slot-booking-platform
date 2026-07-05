"use strict";

const cron   = require("node-cron");
const prisma = require("./prisma");
const { sendAigDigest } = require("./mailer");

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
      include: { aig: { select: { id: true, name: true, slug: true } } },
    });

    for (const admin of aigAdmins) {
      if (!admin.aig) continue;
      // Disha's admin doesn't want the daily digest.
      if (admin.aig.slug === "disha") continue;

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
  // Every day at 08:00 IST. Session reminders are no longer sent by email —
  // the .ics calendar invite carries its own 30-minute VALARM instead
  // (see calendarInvite.js), which every major calendar client honors natively.
  cron.schedule("0 8 * * *", sendDailyDigests, { timezone: "Asia/Kolkata" });

  console.log("Scheduler started (digest at 08:00 IST)");
}

module.exports = { startScheduler };
