"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Parthsaarthi database...\n");

  // ── 1. AIGs ────────────────────────────────────────────────────────────────
  // These slugs are what /admin/:aigSlug resolves against.
  const disha = await prisma.aIG.upsert({
    where: { slug: "disha" },
    update: {},
    create: { slug: "disha", name: "Team Disha", type: "Core Preparation" },
  });

  const consulting = await prisma.aIG.upsert({
    where: { slug: "consulting" },
    update: {},
    create: {
      slug: "consulting",
      name: "Consulting & Strategy Club",
      type: "Domain AIG",
    },
  });

  const finance = await prisma.aIG.upsert({
    where: { slug: "finance" },
    update: {},
    create: { slug: "finance", name: "Credence Capital", type: "Domain AIG" },
  });

  console.log(`AIGs: ${disha.slug}, ${consulting.slug}, ${finance.slug}`);

  // ── 2. Bootstrap AccessWhitelist ───────────────────────────────────────────
  // One SuperADMIN row. The email here must match the Google account used in Phase 3.
  const superAdmin = await prisma.accessWhitelist.upsert({
    where: { email: "pgp41137@iiml.ac.in" },
    update: {},
    create: {
      email: "pgp41137@iiml.ac.in",
      role: "SuperADMIN",
      addedBy: "seed",
    },
  });

  // One AIGs-tier row scoped to disha (example — add more via the admin UI in Phase 6)
  const dishaAdmin = await prisma.accessWhitelist.upsert({
    where: { email: "disha-admin@iiml.ac.in" },
    update: {},
    create: {
      email: "disha-admin@iiml.ac.in",
      role: "AIGs",
      aigId: disha.id,
      addedBy: "seed",
    },
  });

  console.log(
    `AccessWhitelist: ${superAdmin.email} (SuperADMIN), ${dishaAdmin.email} (AIGs/disha)`,
  );

  // ── 3. BanPolicyTiers ──────────────────────────────────────────────────────
  // Configurable — edit here or later via DB to tune thresholds.
  const tiers = [
    {
      strikeThreshold: 1,
      banDurationHours: 24,
      description: "First strike: 24-hour booking ban",
    },
    {
      strikeThreshold: 2,
      banDurationHours: 72,
      description: "Second strike: 72-hour booking ban",
    },
    {
      strikeThreshold: 3,
      banDurationHours: null,
      description: "Third strike: permanent ban — requires SuperADMIN to lift",
    },
  ];

  for (const tier of tiers) {
    await prisma.banPolicyTier.upsert({
      where: { strikeThreshold: tier.strikeThreshold },
      update: { banDurationHours: tier.banDurationHours, description: tier.description },
      create: tier,
    });
  }

  console.log(`BanPolicyTiers: ${tiers.length} tiers seeded (1→24hr, 2→72hr, 3→permanent)`);

  // ── 4. SystemConfig ────────────────────────────────────────────────────────
  // cv_freeze_deadline: ISO-8601 UTC string, read by AigAdminDashboard countdown.
  // Set to ~2 weeks from the reference date of this seed.
  const configs = [
    {
      key: "cv_freeze_deadline",
      value: "2026-07-05T23:59:00.000Z",
    },
    {
      key: "booking_open",
      value: "true", // global kill-switch; booking controller checks this
    },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }

  console.log(
    `SystemConfig: cv_freeze_deadline=2026-07-05T23:59:00.000Z, booking_open=true`,
  );

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
