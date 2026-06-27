"use strict";

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── Static data ────────────────────────────────────────────────────────────────

// Corrected against the real IIML org chart: Disha is a Committee, not an AIG.
// The previous 6 non-Disha entries used made-up names that matched nothing real
// (e.g. "Credence Capital" is actually a Club, not an AIG). Slugs are kept as-is
// (internal identifiers only, never shown to users) to avoid touching every
// FIRMS/DOMAINS lookup key and existing FK — only `name`/`category` change.
const AIG_DEFS = [
  { slug: "disha",      name: "Team Disha",                                       type: "Core Preparation", category: "COMMITTEE", hasCohort: true  },
  { slug: "consulting", name: "Consulting & Strategy Club",                       type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "finance",    name: "SIGFI",                                            type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "marketing",  name: "PRiSM – The Marketing Cell",                       type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "ops",        name: "Operations Interest Group",                        type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "analytics",  name: "Biztech",                                          type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "hr",         name: "HELICS – The HR Club",                             type: "Domain AIG",       category: "AIG",       hasCohort: false },
  { slug: "igfab",      name: "Interest Group in Food and Agri-Business (IGFAB)", type: "Domain AIG",       category: "AIG",       hasCohort: false },
];

// Mentors with no AIG affiliation at all — current PGP2 students mentoring
// independently of any Committee/Club/AIG structure.
const NON_AIG_MENTOR_COUNT = 5;

// Real Disha mentors — cohortLabel maps to the Q1–Q17 cohorts created in Phase 4
const DISHA_MENTORS = [
  { name: "Adit",        email: "pgp41259@iiml.ac.in", cohortLabel: "Q1",  slug: "disha-adit",        firm: "McKinsey & Co.",      domain: "General Management"     },
  { name: "Anandu",      email: "pgp41294@iiml.ac.in", cohortLabel: "Q2",  slug: "disha-anandu",      firm: "BCG",                 domain: "Strategy Consulting"    },
  { name: "Chetan",      email: "pgp41302@iiml.ac.in", cohortLabel: "Q3",  slug: "disha-chetan",      firm: "Bain & Co.",          domain: "Finance"                },
  { name: "Darsh",       email: "pgp41247@iiml.ac.in", cohortLabel: "Q4",  slug: "disha-darsh",       firm: "Goldman Sachs",       domain: "Investment Banking"     },
  { name: "Deepansh",    email: "pgp41250@iiml.ac.in", cohortLabel: "Q5",  slug: "disha-deepansh",    firm: "JP Morgan",           domain: "Operations"             },
  { name: "Gayathri",    email: "pgp41191@iiml.ac.in", cohortLabel: "Q6",  slug: "disha-gayathri",    firm: "Deloitte",            domain: "Analytics"              },
  { name: "Krishnanshu", email: "abm22011@iiml.ac.in", cohortLabel: "Q7",  slug: "disha-krishnanshu", firm: "EY",                  domain: "Human Resources"        },
  { name: "Lohhit",      email: "pgp41485@iiml.ac.in", cohortLabel: "Q8",  slug: "disha-lohhit",      firm: "KPMG",                domain: "Technology"             },
  { name: "Manav",       email: "pgp41263@iiml.ac.in", cohortLabel: "Q9",  slug: "disha-manav",       firm: "Amazon",              domain: "Product Management"     },
  { name: "Manjari",     email: "pgp41020@iiml.ac.in", cohortLabel: "Q10", slug: "disha-manjari",     firm: "ITC",                 domain: "Marketing"              },
  { name: "Riddhi",      email: "pgp41437@iiml.ac.in", cohortLabel: "Q11", slug: "disha-riddhi",      firm: "HUL",                 domain: "FMCG"                   },
  { name: "Sarang",      email: "pgp41392@iiml.ac.in", cohortLabel: "Q12", slug: "disha-sarang",      firm: "Samsung India",       domain: "Entrepreneurship"       },
  { name: "Saumyaa",     email: "pgp41222@iiml.ac.in", cohortLabel: "Q13", slug: "disha-saumyaa",     firm: "TCS",                 domain: "Fintech"                },
  { name: "Sreeraj",     email: "pgp41052@iiml.ac.in", cohortLabel: "Q14", slug: "disha-sreeraj",     firm: "Reliance Industries", domain: "E-Commerce"             },
  { name: "Sristi",      email: "pgp41447@iiml.ac.in", cohortLabel: "Q15", slug: "disha-sristi",      firm: "Infosys",             domain: "Sustainability"         },
  { name: "Tanmay",      email: "pgp41227@iiml.ac.in", cohortLabel: "Q16", slug: "disha-tanmay",      firm: "Accenture",           domain: "Digital Transformation" },
  { name: "Urvee",       email: "pgp41515@iiml.ac.in", cohortLabel: "Q17", slug: "disha-urvee",       firm: "PwC",                 domain: "Consulting"             },
];

const FIRMS = {
  consulting: ["McKinsey & Co.", "BCG", "Bain & Co.", "Roland Berger", "OC&M", "A.T. Kearney", "Strategy&", "L.E.K. Consulting", "Accenture Strategy", "Oliver Wyman", "Monitor Deloitte", "ZS Associates", "Arthur D. Little", "Kearney", "Simon-Kucher"],
  finance:    ["Goldman Sachs", "Morgan Stanley", "JP Morgan", "Citi", "Barclays", "Deutsche Bank", "HSBC", "UBS", "Bank of America", "Kotak IB", "ICICI Securities", "Motilal Oswal", "Edelweiss", "Axis Capital", "Avendus Capital"],
  marketing:  ["HUL", "P&G", "Nestlé", "Coca-Cola", "PepsiCo", "ITC", "Samsung India", "Marico", "Dabur", "Colgate-Palmolive", "L'Oréal India", "Amazon India", "Flipkart", "Reliance Retail", "Myntra"],
  ops:        ["Amazon", "Flipkart", "Meesho", "Zomato", "Swiggy", "Ola", "Uber", "TCS", "Infosys", "Wipro", "Delhivery", "Blue Dart", "DHL", "Mahindra Logistics", "Container Corp of India"],
  analytics:  ["Google", "Meta", "Amazon", "Microsoft", "Mu Sigma", "Fractal Analytics", "Absolutdata", "WNS Analytics", "LatentView", "Tiger Analytics", "EXL Analytics", "Genpact", "Accenture Analytics", "Deloitte Insights", "KPMG Data"],
  hr:         ["Deloitte", "EY", "KPMG", "PwC", "Aon Hewitt", "Mercer", "Willis Towers Watson", "Hewitt Associates", "ManpowerGroup", "Randstad", "McKinsey People & Org", "Accenture HR", "IBM Kenexa", "SAP SuccessFactors", "Workday"],
  igfab:      ["ITC Agro", "Cargill India", "Nestlé", "ADM", "Olam Agri", "PepsiCo Foods", "Britannia", "Godrej Agrovet", "AGCO", "Mahindra Agri", "Bayer CropScience", "Syngenta", "UPL", "Rallis India", "Jain Irrigation"],
};

const DOMAINS = {
  consulting: ["Strategy Consulting", "Management Consulting", "Digital Transformation", "Operations Consulting", "Financial Advisory", "Risk Consulting", "HR Consulting", "IT Consulting", "Healthcare Consulting", "Consumer & Retail", "Private Equity Advisory", "Public Sector", "Infrastructure", "Energy Consulting", "Pricing Strategy"],
  finance:    ["Investment Banking", "Private Equity", "Equity Research", "Corporate Finance", "Asset Management", "Risk Management", "Wealth Management", "Structured Finance", "Fixed Income", "M&A Advisory", "Debt Capital Markets", "ECM", "Sales & Trading", "Quantitative Finance", "Credit Research"],
  marketing:  ["Brand Management", "Digital Marketing", "Category Management", "Consumer Insights", "Trade Marketing", "Product Marketing", "Growth Marketing", "Content Strategy", "Retail Marketing", "B2B Marketing", "Performance Marketing", "CRM", "Shopper Marketing", "Media Planning", "Marketing Analytics"],
  ops:        ["Supply Chain Management", "Logistics & Distribution", "Procurement", "Manufacturing Operations", "Project Management", "Quality Management", "Warehousing", "Last-Mile Delivery", "Demand Planning", "Inventory Management", "Vendor Management", "Process Excellence", "Lean / Six Sigma", "Fleet Management", "Capacity Planning"],
  analytics:  ["Data Science", "Business Analytics", "Machine Learning", "Business Intelligence", "Statistical Modeling", "Product Analytics", "Marketing Analytics", "Risk Analytics", "NLP / AI", "Data Engineering", "Customer Analytics", "Pricing Analytics", "Forecasting", "A/B Testing", "GenAI Applications"],
  hr:         ["Talent Acquisition", "HR Business Partner", "Learning & Development", "Compensation & Benefits", "Organisational Development", "Employee Relations", "HR Analytics", "Diversity & Inclusion", "Change Management", "Performance Management", "Succession Planning", "Employer Branding", "HRIS Implementation", "Culture & Engagement", "Executive Coaching"],
  igfab:      ["Agribusiness Strategy", "Food Supply Chain", "Agri-Commodity Trading", "Sustainable Agriculture", "Food Processing", "Agri-Fintech", "Rural Distribution", "Crop Science", "Agri-Exports", "Farm-to-Fork Operations", "Agri Risk Management", "Cold Chain Logistics", "Agri-Tech", "Seed & Input Sales", "Agri Policy"],
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
      update: { name: def.name, type: def.type, category: def.category },
      create: { slug: def.slug, name: def.name, type: def.type, category: def.category },
    });
  }
  // Disha AIG admin whitelist
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
    { key: "cv_freeze_deadline",        value: "2026-07-05T23:59:00.000Z" },
    { key: "booking_open",              value: "true"                      },
    { key: "penalty_warning_minutes",   value: "60" },
    { key: "penalty_strike_minutes",    value: "30" },
    { key: "penalty_warning_to_strike", value: "3"  },
  ]) {
    await prisma.systemConfig.upsert({
      where:  { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }
  console.log("         ✓ done");

  // ── Phase 4: Disha cohorts Q1–Q17 ────────────────────────────────────────
  console.log("\nPhase 4  Disha cohorts (Q1–Q17)...");
  const DISHA_COHORT_COUNT    = DISHA_MENTORS.length; // 17
  const STUDENTS_PER_COHORT   = 20;                   // 17 × 20 = 340 students

  const dishaCohorts = {}; // label → cohort record
  for (const mentor of DISHA_MENTORS) {
    const c = await prisma.cohort.create({
      data: { label: mentor.cohortLabel, aigId: aigs.disha.id },
    });
    dishaCohorts[mentor.cohortLabel] = c;
  }
  const dishaCohortList = DISHA_MENTORS.map((m) => dishaCohorts[m.cohortLabel]);
  console.log(`         ✓ ${DISHA_COHORT_COUNT} cohorts (${DISHA_MENTORS.map((m) => m.cohortLabel).join(", ")})`);

  // ── Phase 5: Mentors ──────────────────────────────────────────────────────
  console.log("\nPhase 5  Mentors...");

  const wlMentors  = [];
  const usrMentors = [];
  const profMeta   = [];

  // Real Disha mentors (17)
  for (const m of DISHA_MENTORS) {
    const cohort = dishaCohorts[m.cohortLabel];
    wlMentors.push({ email: m.email, role: "MENTOR", aigId: aigs.disha.id, addedBy: "seed" });
    usrMentors.push({ email: m.email, name: m.name, role: "MENTOR" });
    profMeta.push({ email: m.email, slug: m.slug, firm: m.firm, domain: m.domain, aigId: aigs.disha.id, cohortId: cohort.id });
  }

  // Dummy mentors for non-Disha AIGs (6 × 15 = 90)
  for (const def of AIG_DEFS.filter((d) => d.slug !== "disha")) {
    const aig = aigs[def.slug];
    for (let i = 1; i <= 15; i++) {
      const n      = String(i).padStart(2, "0");
      const label  = def.slug.charAt(0).toUpperCase() + def.slug.slice(1);
      const email  = `${def.slug}.mentor.${n}@iiml.ac.in`;
      const name   = `${label} Mentor ${n}`;
      const slug   = `${def.slug}-mentor-${n}`;
      wlMentors.push({ email, role: "MENTOR", aigId: aig.id, addedBy: "seed" });
      usrMentors.push({ email, name, role: "MENTOR" });
      profMeta.push({ email, slug, firm: FIRMS[def.slug][i - 1], domain: DOMAINS[def.slug][i - 1], aigId: aig.id, cohortId: null });
    }
  }

  // Non-AIG mentors — PGP2 students mentoring with no Committee/Club/AIG affiliation
  for (let i = 1; i <= NON_AIG_MENTOR_COUNT; i++) {
    const n     = String(i).padStart(2, "0");
    const email = `independent.mentor.${n}@iiml.ac.in`;
    const name  = `Independent Mentor ${n}`;
    const slug  = `independent-mentor-${n}`;
    wlMentors.push({ email, role: "MENTOR", aigId: null, addedBy: "seed" });
    usrMentors.push({ email, name, role: "MENTOR" });
    profMeta.push({
      email, slug,
      firm: "PGP2 Peer Mentor", domain: "General CV Review",
      aigId: null, cohortId: null, mentorType: "PGP2_STUDENT",
    });
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
      userId:     mEmail2Id[m.email],
      slug:       m.slug,
      firm:       m.firm,
      domain:     m.domain,
      aigId:      m.aigId,
      cohortId:   m.cohortId,
      mentorType: m.mentorType ?? "ALUMNI",
    })),
  });
  const AIG_DUMMY_COUNT = (AIG_DEFS.length - 1) * 15; // all non-Disha AIGs × 15 each
  console.log(`         ✓ ${DISHA_MENTORS.length} Disha (real) + ${AIG_DUMMY_COUNT} AIG (dummy) + ${NON_AIG_MENTOR_COUNT} non-AIG (dummy) = ${DISHA_MENTORS.length + AIG_DUMMY_COUNT + NON_AIG_MENTOR_COUNT} total`);

  // ── Phase 6: Students (17 × 20 = 340) ────────────────────────────────────
  console.log("\nPhase 6  Students (340 total, 20 per Disha cohort)...");

  const STUDENT_COUNT = DISHA_COHORT_COUNT * STUDENTS_PER_COHORT;
  const wlStudents   = [];
  const usrStudents  = [];
  const profStudents = [];

  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const n        = String(i).padStart(3, "0");
    const email    = `student.${n}@iiml.ac.in`;
    const name     = `Student ${n}`;
    const pgpId    = `25${n}`;
    const cohort   = dishaCohortList[Math.floor((i - 1) / STUDENTS_PER_COHORT)];

    wlStudents.push({ email, role: "STUDENT", cohortId: cohort.id, addedBy: "seed" });
    usrStudents.push({ email, name, role: "STUDENT" });
    profStudents.push({ email, pgpId, cohortId: cohort.id });
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

  // ── Phase 7: Dev/test accounts ────────────────────────────────────────────
  console.log("\nPhase 7  Dev test accounts...");

  // SuperADMIN — never deleted, just ensure name is set
  await prisma.user.upsert({
    where:  { email: "pgp41137@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "pgp41137@iiml.ac.in", name: "Hrishikesh Kumar", role: "SuperADMIN" },
  });

  // STUDENT test alias — placed in Q1 cohort (alongside Student 001–020)
  const q1Cohort = dishaCohorts["Q1"];
  await prisma.accessWhitelist.upsert({
    where:  { email: "hrishikesh.student@iiml.ac.in" },
    update: { cohortId: q1Cohort.id },
    create: { email: "hrishikesh.student@iiml.ac.in", role: "STUDENT", cohortId: q1Cohort.id, addedBy: "seed" },
  });
  const hriStu = await prisma.user.upsert({
    where:  { email: "hrishikesh.student@iiml.ac.in" },
    update: { name: "Hrishikesh Kumar" },
    create: { email: "hrishikesh.student@iiml.ac.in", name: "Hrishikesh Kumar", role: "STUDENT" },
  });
  const existingStuProfile = await prisma.studentProfile.findUnique({ where: { userId: hriStu.id } });
  if (!existingStuProfile) {
    await prisma.studentProfile.create({
      data: { userId: hriStu.id, pgpId: "41137", cohortId: q1Cohort.id },
    });
  }

  // MENTOR test alias — Disha, Q1 cohort
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
    update: { cohortId: q1Cohort.id },
    create: {
      userId:   hriMen.id,
      slug:     "hrishikesh-kumar",
      firm:     "— Test Account —",
      domain:   "All Domains",
      aigId:    aigs.disha.id,
      cohortId: q1Cohort.id,
    },
  });

  // AIGs/disha test alias
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

  console.log("         ✓ 4 dev accounts ready");

  // ── Summary ───────────────────────────────────────────────────────────────
  const [users, mentors, students, whitelist, cohorts] = await Promise.all([
    prisma.user.count(),
    prisma.mentorProfile.count(),
    prisma.studentProfile.count(),
    prisma.accessWhitelist.count(),
    prisma.cohort.count(),
  ]);

  console.log("\n── Summary ─────────────────────────────────────────────────────");
  console.log(`  Org units        ${AIG_DEFS.length}  (1 Committee: Disha, ${AIG_DEFS.length - 1} AIGs)`);
  console.log(`  Cohorts          ${cohorts}  (Disha: Q1–Q17)`);
  console.log(`  MentorProfiles   ${mentors}  (17 real Disha + ${AIG_DUMMY_COUNT} AIG dummy + ${NON_AIG_MENTOR_COUNT} non-AIG dummy + 1 test)`);
  console.log(`  StudentProfiles  ${students}`);
  console.log(`  Users            ${users}`);
  console.log(`  Whitelist        ${whitelist}`);

  console.log("\n── Disha mentor roster ──────────────────────────────────────────");
  for (const m of DISHA_MENTORS) {
    console.log(`  ${m.cohortLabel.padEnd(4)} ${m.name.padEnd(14)} ${m.email}`);
  }

  console.log("\n── Dev login reference ──────────────────────────────────────────");
  console.log("  pgp41137@iiml.ac.in           SuperADMIN   /admin/placements");
  console.log("  hrishikesh.student@iiml.ac.in STUDENT      /student  (Q1 cohort)");
  console.log("  hrishikesh.mentor@iiml.ac.in  MENTOR       /mentor   (Q1 cohort)");
  console.log("  hrishikesh.aig@iiml.ac.in     AIGs/disha   /admin/disha");
  console.log("  disha-admin@iiml.ac.in        AIGs/disha   /admin/disha");
  console.log("  student.001@iiml.ac.in        STUDENT      /student  (Q1 cohort)");
  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
