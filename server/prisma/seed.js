"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── Static data ────────────────────────────────────────────────────────────────

const AIG_DEFS = [
  { slug: "disha",      name: "Team Disha",                           type: "Core Preparation", hasCohort: true  },
  { slug: "consulting", name: "Consulting & Strategy Club",           type: "Domain AIG",       hasCohort: false },
  { slug: "finance",    name: "Credence Capital",                     type: "Domain AIG",       hasCohort: false },
  { slug: "marketing",  name: "Marketing & Sales Club",               type: "Domain AIG",       hasCohort: false },
  { slug: "ops",        name: "Operations & Supply Chain Club",       type: "Domain AIG",       hasCohort: false },
  { slug: "analytics",  name: "Analytics & Data Science Club",        type: "Domain AIG",       hasCohort: false },
  { slug: "hr",         name: "HR & Organisational Behaviour Club",   type: "Domain AIG",       hasCohort: false },
];

const FIRMS = {
  disha:      ["McKinsey & Co.", "BCG", "Bain & Co.", "Goldman Sachs", "JP Morgan", "Deloitte", "EY", "KPMG", "Amazon", "ITC", "HUL", "Samsung India", "TCS", "Reliance Industries", "Infosys"],
  consulting: ["McKinsey & Co.", "BCG", "Bain & Co.", "Roland Berger", "OC&M", "A.T. Kearney", "Strategy&", "L.E.K. Consulting", "Accenture Strategy", "Oliver Wyman", "Monitor Deloitte", "ZS Associates", "Arthur D. Little", "Kearney", "Simon-Kucher"],
  finance:    ["Goldman Sachs", "Morgan Stanley", "JP Morgan", "Citi", "Barclays", "Deutsche Bank", "HSBC", "UBS", "Bank of America", "Kotak IB", "ICICI Securities", "Motilal Oswal", "Edelweiss", "Axis Capital", "Avendus Capital"],
  marketing:  ["HUL", "P&G", "Nestlé", "Coca-Cola", "PepsiCo", "ITC", "Samsung India", "Marico", "Dabur", "Colgate-Palmolive", "L'Oréal India", "Amazon India", "Flipkart", "Reliance Retail", "Myntra"],
  ops:        ["Amazon", "Flipkart", "Meesho", "Zomato", "Swiggy", "Ola", "Uber", "TCS", "Infosys", "Wipro", "Delhivery", "Blue Dart", "DHL", "Mahindra Logistics", "Container Corp of India"],
  analytics:  ["Google", "Meta", "Amazon", "Microsoft", "Mu Sigma", "Fractal Analytics", "Absolutdata", "WNS Analytics", "LatentView", "Tiger Analytics", "EXL Analytics", "Genpact", "Accenture Analytics", "Deloitte Insights", "KPMG Data"],
  hr:         ["Deloitte", "EY", "KPMG", "PwC", "Aon Hewitt", "Mercer", "Willis Towers Watson", "Hewitt Associates", "ManpowerGroup", "Randstad", "McKinsey People & Org", "Accenture HR", "IBM Kenexa", "SAP SuccessFactors", "Workday"],
};

const DOMAINS = {
  disha:      ["General Management", "Strategy Consulting", "Finance", "Marketing", "Operations", "Analytics", "Human Resources", "Technology", "Investment Banking", "Product Management", "Entrepreneurship", "FMCG", "Fintech", "E-Commerce", "Sustainability"],
  consulting: ["Strategy Consulting", "Management Consulting", "Digital Transformation", "Operations Consulting", "Financial Advisory", "Risk Consulting", "HR Consulting", "IT Consulting", "Healthcare Consulting", "Consumer & Retail", "Private Equity Advisory", "Public Sector", "Infrastructure", "Energy Consulting", "Pricing Strategy"],
  finance:    ["Investment Banking", "Private Equity", "Equity Research", "Corporate Finance", "Asset Management", "Risk Management", "Wealth Management", "Structured Finance", "Fixed Income", "M&A Advisory", "Debt Capital Markets", "ECM", "Sales & Trading", "Quantitative Finance", "Credit Research"],
  marketing:  ["Brand Management", "Digital Marketing", "Category Management", "Consumer Insights", "Trade Marketing", "Product Marketing", "Growth Marketing", "Content Strategy", "Retail Marketing", "B2B Marketing", "Performance Marketing", "CRM", "Shopper Marketing", "Media Planning", "Marketing Analytics"],
  ops:        ["Supply Chain Management", "Logistics & Distribution", "Procurement", "Manufacturing Operations", "Project Management", "Quality Management", "Warehousing", "Last-Mile Delivery", "Demand Planning", "Inventory Management", "Vendor Management", "Process Excellence", "Lean / Six Sigma", "Fleet Management", "Capacity Planning"],
  analytics:  ["Data Science", "Business Analytics", "Machine Learning", "Business Intelligence", "Statistical Modeling", "Product Analytics", "Marketing Analytics", "Risk Analytics", "NLP / AI", "Data Engineering", "Customer Analytics", "Pricing Analytics", "Forecasting", "A/B Testing", "GenAI Applications"],
  hr:         ["Talent Acquisition", "HR Business Partner", "Learning & Development", "Compensation & Benefits", "Organisational Development", "Employee Relations", "HR Analytics", "Diversity & Inclusion", "Change Management", "Performance Management", "Succession Planning", "Employer Branding", "HRIS Implementation", "Culture & Engagement", "Executive Coaching"],
};

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Parthsaarthi seed — full reset + realistic data\n");

  // ── Phase 1: Clean old demo data ──────────────────────────────────────────
  console.log("Phase 1  Cleaning old data...");
  await prisma.auditEvent.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.slotCapacity.deleteMany({});
  await prisma.slot.deleteMany({});
  await prisma.bookingRelease.deleteMany({});
  await prisma.studentWarning.deleteMany({});
  await prisma.ban.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.mentorProfile.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: "pgp41137@iiml.ac.in" } } });
  await prisma.accessWhitelist.deleteMany({ where: { email: { not: "pgp41137@iiml.ac.in" } } });
  await prisma.cohort.deleteMany({});
  console.log("         ✓ cleared");

  // ── Phase 2: AIGs ─────────────────────────────────────────────────────────
  console.log("\nPhase 2  AIGs...");
  const aigs = {};
  for (const def of AIG_DEFS) {
    aigs[def.slug] = await prisma.aIG.upsert({
      where:  { slug: def.slug },
      update: { name: def.name, type: def.type },
      create: { slug: def.slug, name: def.name, type: def.type },
    });
  }
  // Re-seat the disha AIGs admin whitelist entry
  await prisma.accessWhitelist.upsert({
    where:  { email: "disha-admin@iiml.ac.in" },
    update: { aigId: aigs.disha.id },
    create: { email: "disha-admin@iiml.ac.in", role: "AIGs", aigId: aigs.disha.id, addedBy: "seed" },
  });
  console.log(`         ✓ ${AIG_DEFS.length} AIGs`);

  // ── Phase 3: BanPolicyTiers + SystemConfig ────────────────────────────────
  console.log("\nPhase 3  BanPolicyTiers + SystemConfig...");
  for (const t of [
    { strikeThreshold: 1, banDurationHours: 6,  description: "First strike: 6-hour booking ban"            },
    { strikeThreshold: 2, banDurationHours: 12, description: "Second strike: 12-hour booking ban"           },
    { strikeThreshold: 3, banDurationHours: 24, description: "Third strike: 24-hour ban, then admin review" },
  ]) {
    await prisma.banPolicyTier.upsert({
      where:  { strikeThreshold: t.strikeThreshold },
      update: { banDurationHours: t.banDurationHours, description: t.description },
      create: t,
    });
  }
  for (const cfg of [
    { key: "cv_freeze_deadline",       value: "2026-07-05T23:59:00.000Z" },
    { key: "booking_open",             value: "true"                      },
    // Penalty thresholds (minutes before slot start)
    { key: "penalty_warning_minutes",  value: "60" }, // ≥ this → no penalty
    { key: "penalty_strike_minutes",   value: "30" }, // < this → STRIKE; between → WARNING
    { key: "penalty_warning_to_strike",value: "3"  }, // N warnings auto-convert to 1 strike
  ]) {
    await prisma.systemConfig.upsert({
      where:  { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }
  console.log("         ✓ done");

  // ── Phase 4: Disha cohorts (15) ───────────────────────────────────────────
  console.log("\nPhase 4  Disha cohorts (15)...");
  const COHORT_COUNT  = 15;
  const STUDENTS_PER_COHORT = 20; // 15 × 20 = 300

  const dishaCohorts = [];
  for (let i = 1; i <= COHORT_COUNT; i++) {
    const c = await prisma.cohort.create({
      data: { label: `Cohort ${String(i).padStart(2, "0")}`, aigId: aigs.disha.id },
    });
    dishaCohorts.push(c);
  }
  console.log(`         ✓ ${COHORT_COUNT} cohorts`);

  // ── Phase 5: Mentors (15 per AIG × 7 = 105) ──────────────────────────────
  console.log("\nPhase 5  Mentors (105 total)...");

  const wlMentors  = [];
  const usrMentors = [];
  const profMeta   = []; // {email, slug, firm, domain, aigId, cohortId?}

  for (const def of AIG_DEFS) {
    const aig = aigs[def.slug];
    for (let i = 1; i <= 15; i++) {
      const n      = String(i).padStart(2, "0");
      const label  = def.slug.charAt(0).toUpperCase() + def.slug.slice(1);
      const email  = `${def.slug}.mentor.${n}@iiml.ac.in`;
      const name   = `${label} Mentor ${n}`;
      const slug   = `${def.slug}-mentor-${n}`;
      const firm   = FIRMS[def.slug][i - 1];
      const domain = DOMAINS[def.slug][i - 1];
      // Only Disha mentors get cohort assignments
      const cohortId = def.hasCohort ? dishaCohorts[i - 1].id : null;

      wlMentors.push({ email, role: "MENTOR", aigId: aig.id, addedBy: "seed" });
      usrMentors.push({ email, name, role: "MENTOR" });
      profMeta.push({ email, slug, firm, domain, aigId: aig.id, cohortId });
    }
  }

  await prisma.accessWhitelist.createMany({ data: wlMentors });
  await prisma.user.createMany({ data: usrMentors });

  const mentorUsers = await prisma.user.findMany({
    where:  { email: { in: usrMentors.map((u) => u.email) } },
    select: { id: true, email: true },
  });
  const mEmail2Id = Object.fromEntries(mentorUsers.map((u) => [u.email, u.id]));

  await prisma.mentorProfile.createMany({
    data: profMeta.map((m) => ({
      userId:   mEmail2Id[m.email],
      slug:     m.slug,
      firm:     m.firm,
      domain:   m.domain,
      aigId:    m.aigId,
      cohortId: m.cohortId,
    })),
      });
  console.log("         ✓ 105 mentors");

  // ── Phase 6: Students (300 total, 20 per Disha cohort) ───────────────────
  console.log("\nPhase 6  Students (300 total)...");

  const STUDENT_COUNT = COHORT_COUNT * STUDENTS_PER_COHORT; // 300
  const wlStudents    = [];
  const usrStudents   = [];
  const profStudents  = []; // {email, pgpId, cohortId}

  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const n        = String(i).padStart(3, "0");
    const email    = `student.${n}@iiml.ac.in`;
    const name     = `Student ${n}`;
    const pgpId    = `25${n}`;                                         // 25001–25300
    const cohortId = dishaCohorts[Math.floor((i - 1) / STUDENTS_PER_COHORT)].id;

    wlStudents.push({ email, role: "STUDENT", cohortId, addedBy: "seed" });
    usrStudents.push({ email, name, role: "STUDENT" });
    profStudents.push({ email, pgpId, cohortId });
  }

  await prisma.accessWhitelist.createMany({ data: wlStudents });
  await prisma.user.createMany({ data: usrStudents });

  const studentUsers = await prisma.user.findMany({
    where:  { email: { in: usrStudents.map((u) => u.email) } },
    select: { id: true, email: true },
  });
  const sEmail2Id = Object.fromEntries(studentUsers.map((u) => [u.email, u.id]));

  await prisma.studentProfile.createMany({
    data: profStudents.map((s) => ({
      userId:   sEmail2Id[s.email],
      pgpId:    s.pgpId,
      cohortId: s.cohortId,
    })),
      });
  console.log(`         ✓ ${STUDENT_COUNT} students (${STUDENTS_PER_COHORT} per cohort)`);

  // ── Phase 7: Hrishikesh test accounts ─────────────────────────────────────
  console.log("\nPhase 7  Hrishikesh test accounts...");

  // SuperADMIN (pgp41137 was never deleted — just fix the name)
  await prisma.user.upsert({
    where:  { email: "pgp41137@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "pgp41137@iiml.ac.in", name: "Hrishikesh Kumar", role: "SuperADMIN" },
  });

  // STUDENT alias  — placed in Cohort 01 alongside Student 001–020
  const testCohort = dishaCohorts[0];
  await prisma.accessWhitelist.upsert({
    where:  { email: "hrishikesh.student@iiml.ac.in" },
    update: { cohortId: testCohort.id },
    create: { email: "hrishikesh.student@iiml.ac.in", role: "STUDENT", cohortId: testCohort.id, addedBy: "seed" },
  });
  const hriStu = await prisma.user.upsert({
    where:  { email: "hrishikesh.student@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "hrishikesh.student@iiml.ac.in", name: "Hrishikesh Kumar", role: "STUDENT" },
  });
  const existingStuProfile = await prisma.studentProfile.findUnique({ where: { userId: hriStu.id } });
  if (!existingStuProfile) {
    // pgpId 41137 is deliberately outside the 25001–25300 batch range
    await prisma.studentProfile.create({
      data: { userId: hriStu.id, pgpId: "41137", cohortId: testCohort.id },
    });
  }

  // MENTOR alias  — Disha, Cohort 01 (same as the test student)
  await prisma.accessWhitelist.upsert({
    where:  { email: "hrishikesh.mentor@iiml.ac.in" },
    update: { aigId: aigs.disha.id },
    create: { email: "hrishikesh.mentor@iiml.ac.in", role: "MENTOR", aigId: aigs.disha.id, addedBy: "seed" },
  });
  const hriMen = await prisma.user.upsert({
    where:  { email: "hrishikesh.mentor@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "hrishikesh.mentor@iiml.ac.in", name: "Hrishikesh Kumar", role: "MENTOR" },
  });
  await prisma.mentorProfile.upsert({
    where:  { userId: hriMen.id },
    update: { cohortId: testCohort.id },
    create: {
      userId:   hriMen.id,
      slug:     "hrishikesh-kumar",
      firm:     "— Test Account —",
      domain:   "All Domains",
      aigId:    aigs.disha.id,
      cohortId: testCohort.id,
    },
  });

  // AIGs/disha alias
  await prisma.accessWhitelist.upsert({
    where:  { email: "hrishikesh.aig@iiml.ac.in" },
    update: { aigId: aigs.disha.id },
    create: { email: "hrishikesh.aig@iiml.ac.in", role: "AIGs", aigId: aigs.disha.id, addedBy: "seed" },
  });
  await prisma.user.upsert({
    where:  { email: "hrishikesh.aig@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "hrishikesh.aig@iiml.ac.in", name: "Hrishikesh Kumar", role: "AIGs" },
  });

  console.log("         ✓ 4 accounts ready");

  // ── Summary ───────────────────────────────────────────────────────────────
  const [users, mentors, students, whitelist, cohorts] = await Promise.all([
    prisma.user.count(),
    prisma.mentorProfile.count(),
    prisma.studentProfile.count(),
    prisma.accessWhitelist.count(),
    prisma.cohort.count(),
  ]);

  console.log("\n── Summary ─────────────────────────────────────────────────────");
  console.log(`  AIGs             ${AIG_DEFS.length}   (7 total)`);
  console.log(`  Cohorts          ${cohorts}  (Disha only)`);
  console.log(`  MentorProfiles   ${mentors}`);
  console.log(`  StudentProfiles  ${students}`);
  console.log(`  Users            ${users}`);
  console.log(`  Whitelist        ${whitelist}`);

  console.log("\n── Dev login reference ──────────────────────────────────────────");
  console.log("  pgp41137@iiml.ac.in           SuperADMIN   /admin/placements");
  console.log("  hrishikesh.student@iiml.ac.in STUDENT      /student");
  console.log("  hrishikesh.mentor@iiml.ac.in  MENTOR       /mentor");
  console.log("  hrishikesh.aig@iiml.ac.in     AIGs/disha   /admin/disha");
  console.log("  disha-admin@iiml.ac.in         AIGs/disha   /admin/disha");
  console.log("  student.001@iiml.ac.in         STUDENT      /student");
  console.log("  disha.mentor.01@iiml.ac.in     MENTOR       /mentor");
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
