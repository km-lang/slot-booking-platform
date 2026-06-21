"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Parthsaarthi database...\n");

  // ── 1. AIGs ────────────────────────────────────────────────────────────────
  const disha = await prisma.aIG.upsert({
    where: { slug: "disha" },
    update: {},
    create: { slug: "disha", name: "Team Disha", type: "Core Preparation" },
  });

  const consulting = await prisma.aIG.upsert({
    where: { slug: "consulting" },
    update: {},
    create: { slug: "consulting", name: "Consulting & Strategy Club", type: "Domain AIG" },
  });

  const finance = await prisma.aIG.upsert({
    where: { slug: "finance" },
    update: {},
    create: { slug: "finance", name: "Credence Capital", type: "Domain AIG" },
  });

  console.log(`AIGs: ${disha.slug}, ${consulting.slug}, ${finance.slug}`);

  // ── 2. Bootstrap AccessWhitelist ───────────────────────────────────────────
  const superAdmin = await prisma.accessWhitelist.upsert({
    where: { email: "pgp41137@iiml.ac.in" },
    update: {},
    create: { email: "pgp41137@iiml.ac.in", role: "SuperADMIN", addedBy: "seed" },
  });

  const dishaAdmin = await prisma.accessWhitelist.upsert({
    where: { email: "disha-admin@iiml.ac.in" },
    update: {},
    create: { email: "disha-admin@iiml.ac.in", role: "AIGs", aigId: disha.id, addedBy: "seed" },
  });

  console.log(`AccessWhitelist: ${superAdmin.email} (SuperADMIN), ${dishaAdmin.email} (AIGs/disha)`);

  // ── 3. BanPolicyTiers ──────────────────────────────────────────────────────
  const tiers = [
    { strikeThreshold: 1, banDurationHours: 6, description: "First strike: 6-hour booking ban" },
    { strikeThreshold: 2, banDurationHours: 12, description: "Second strike: 12-hour booking ban" },
    { strikeThreshold: 3, banDurationHours: 24, description: "Third strike: 1 day ban, then permanent ban until admin review" },
  ];

  for (const tier of tiers) {
    await prisma.banPolicyTier.upsert({
      where: { strikeThreshold: tier.strikeThreshold },
      update: { banDurationHours: tier.banDurationHours, description: tier.description },
      create: tier,
    });
  }

  console.log(`BanPolicyTiers: ${tiers.length} tiers seeded (1→6hr, 2→12hr, 3→24hr + review)`);

  // ── 4. SystemConfig ────────────────────────────────────────────────────────
  const configs = [
    { key: "cv_freeze_deadline", value: "2026-07-05T23:59:00.000Z" },
    { key: "booking_open", value: "true" },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }

  console.log(`SystemConfig: cv_freeze_deadline=2026-07-05T23:59:00.000Z, booking_open=true`);

  // ── 5. Demo Cohorts ────────────────────────────────────────────────────────
  let cohortQ4 = await prisma.cohort.findFirst({ where: { label: "Q4", aigId: disha.id } });
  if (!cohortQ4) cohortQ4 = await prisma.cohort.create({ data: { label: "Q4", aigId: disha.id } });

  let cohortSummer = await prisma.cohort.findFirst({ where: { label: "Summer Batch", aigId: consulting.id } });
  if (!cohortSummer) cohortSummer = await prisma.cohort.create({ data: { label: "Summer Batch", aigId: consulting.id } });

  let cohortFinance = await prisma.cohort.findFirst({ where: { label: "Finance Track", aigId: finance.id } });
  if (!cohortFinance) cohortFinance = await prisma.cohort.create({ data: { label: "Finance Track", aigId: finance.id } });

  console.log(`Cohorts: Q4 (disha), Summer Batch (consulting), Finance Track (finance)`);

  // ── 6. Demo Mentor Users + Whitelist + Profiles ────────────────────────────
  const mentorEmails = [
    { email: "evelyn.vance@iiml.ac.in", name: "Evelyn Vance", slug: "evelyn-vance", firm: "McKinsey & Company", domain: "Consulting", aigId: disha.id, cohortId: cohortQ4.id },
    { email: "arjun.mehta@iiml.ac.in", name: "Arjun Mehta", slug: "arjun-mehta", firm: "Bain & Company", domain: "Strategy", aigId: consulting.id, cohortId: cohortSummer.id },
    { email: "priya.sharma@iiml.ac.in", name: "Priya Sharma", slug: "priya-sharma", firm: "Goldman Sachs", domain: "Investment Banking", aigId: finance.id, cohortId: cohortFinance.id },
  ];

  const mentorProfiles = {};
  for (const m of mentorEmails) {
    await prisma.accessWhitelist.upsert({
      where: { email: m.email },
      update: {},
      create: { email: m.email, role: "MENTOR", aigId: m.aigId, addedBy: "seed" },
    });

    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: { email: m.email, name: m.name, role: "MENTOR" },
    });

    const profile = await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: { cohortId: m.cohortId },
      create: { userId: user.id, slug: m.slug, firm: m.firm, domain: m.domain, aigId: m.aigId, cohortId: m.cohortId },
    });

    mentorProfiles[m.slug] = profile;
  }

  console.log(`Mentors: ${mentorEmails.map((m) => m.name).join(", ")}`);

  // ── 7. Demo Student Users + Whitelist + Profiles ───────────────────────────
  const studentData = [
    { email: "rohan.gupta@iiml.ac.in", name: "Rohan Gupta", pgpId: "25101", cohortId: cohortQ4.id },
    { email: "dhriti.srivastava@iiml.ac.in", name: "Dhriti Srivastava", pgpId: "25089", cohortId: cohortQ4.id },
    { email: "kabir.khan@iiml.ac.in", name: "Kabir Khan", pgpId: "25125", cohortId: cohortQ4.id },
  ];

  const studentUsers = {};
  for (const s of studentData) {
    await prisma.accessWhitelist.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, role: "STUDENT", cohortId: s.cohortId, addedBy: "seed" },
    });

    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, name: s.name, role: "STUDENT" },
    });

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, pgpId: s.pgpId, cohortId: s.cohortId },
    });

    studentUsers[s.email] = user;
  }

  console.log(`Students: ${studentData.map((s) => s.name).join(", ")}`);

  // ── 8. Demo Slots for Evelyn Vance (4 × 15-min slots, tomorrow at 2 PM) ────
  const evelynProfile = mentorProfiles["evelyn-vance"];
  const existingRelease = await prisma.bookingRelease.findFirst({
    where: { mentorProfileId: evelynProfile.id },
  });

  let demoSlots = [];
  if (!existingRelease) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    const releaseEnd = new Date(tomorrow.getTime() + 4 * 15 * 60000); // 1 hour block

    const release = await prisma.bookingRelease.create({
      data: {
        mentorProfileId: evelynProfile.id,
        startTime: tomorrow,
        endTime: releaseEnd,
        slotDuration: 15,
        venue: "Library — Study Room 3 (In-Person)",
        cohortOnly: false,
      },
    });

    // Create 4 individual slots
    for (let i = 0; i < 4; i++) {
      const start = new Date(tomorrow.getTime() + i * 15 * 60000);
      const end = new Date(start.getTime() + 15 * 60000);
      const slot = await prisma.slot.create({
        data: {
          releaseId: release.id,
          mentorProfileId: evelynProfile.id,
          startTime: start,
          endTime: end,
          venue: release.venue,
          capacity: { create: { max: 1, current: 0 } },
        },
      });
      demoSlots.push(slot);
    }

    console.log(`Slots: 4 demo slots created for Evelyn Vance (tomorrow 2:00–3:00 PM)`);
  } else {
    demoSlots = await prisma.slot.findMany({ where: { mentorProfileId: evelynProfile.id } });
    console.log(`Slots: ${demoSlots.length} existing slots found for Evelyn Vance (skipped re-create)`);
  }

  // ── 9. Sample Booking (Rohan → slot 1, CONFIRMED) ──────────────────────────
  const rohanUser = studentUsers["rohan.gupta@iiml.ac.in"];
  const DEMO_BOOKING_KEY = "demo-seed-booking-rohan-slot1";

  const existingBooking = await prisma.booking.findUnique({ where: { idempotencyKey: DEMO_BOOKING_KEY } });
  if (!existingBooking && demoSlots.length > 0) {
    const slot1 = demoSlots[0];
    await prisma.$transaction([
      prisma.booking.create({
        data: {
          slotId: slot1.id,
          studentUserId: rohanUser.id,
          focus: "overall",
          idempotencyKey: DEMO_BOOKING_KEY,
          status: "CONFIRMED",
        },
      }),
      prisma.slot.update({
        where: { id: slot1.id },
        data: { version: { increment: 1 } },
      }),
      prisma.slotCapacity.update({
        where: { slotId: slot1.id },
        data: { current: 1 },
      }),
      prisma.auditEvent.create({
        data: {
          action: "BOOKING_CREATED",
          entity: "Booking",
          meta: JSON.stringify({ focus: "overall", source: "seed" }),
        },
      }),
    ]);
    console.log(`Booking: Rohan Gupta → Evelyn Vance slot 1 (CONFIRMED, focus=overall)`);
  } else {
    console.log(`Booking: demo booking already exists (skipped)`);
  }

  // ── 10. Sample Active Ban (Kabir Khan — to test ban management UI) ─────────
  const kabirUser = studentUsers["kabir.khan@iiml.ac.in"];
  const activeBan = await prisma.ban.findFirst({
    where: { userId: kabirUser.id, liftedAt: null },
  });

  if (!activeBan) {
    const banEnds = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours from now
    await prisma.ban.create({
      data: {
        userId: kabirUser.id,
        reason: "Late cancellation — STRIKE (demo seed)",
        endsAt: banEnds,
      },
    });
    await prisma.studentWarning.create({
      data: {
        userId: kabirUser.id,
        type: "STRIKE",
        reason: "No-show on demo slot (seed data)",
      },
    });
    console.log(`Ban: Kabir Khan active ban seeded (expires in 24 hours)`);
  } else {
    console.log(`Ban: Kabir Khan already has an active ban (skipped)`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
