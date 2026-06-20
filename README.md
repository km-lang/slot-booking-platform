# Parthsaarthi — SIP Mentor Booking Platform

A high-concurrency slot-booking system for IIM Lucknow's Summer Internship Preparation (SIP) programme. Students book 15-minute CV-review sessions with alumni mentors. The platform handles burst traffic during cohort releases using Optimistic Concurrency Control and enforces a strict whitelist-based access gate.

---

## Repository Structure

```
slot-booking-platform/
├── client/                     React 19 + Vite 8 + Tailwind CSS 3
│   └── src/
│       ├── components/
│       │   └── RequireRole.jsx     Route guard (live)
│       ├── pages/
│       │   ├── StudentLayout.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── MentorBookingView.jsx
│       │   ├── MentorDashboard.jsx
│       │   ├── MentorCohortDetails.jsx
│       │   ├── AigAdminDashboard.jsx   Generic AIG-tier view (/admin/:aigSlug)
│       │   ├── PlacementAdminDashboard.jsx  SuperADMIN KPI + live ops
│       │   ├── LoginPage.jsx           (live — Google Identity Services)
│       │   └── UnauthorizedPage.jsx
│       └── App.jsx                 Route map (RBAC-structured)
│
└── server/                     Node.js + Express 5 + Prisma 6 + SQLite/PostgreSQL
    ├── prisma/
    │   ├── schema.prisma           Full data model (13 tables, 3 enums)
    │   ├── seed.js                 AIGs, whitelist, BanPolicyTiers, SystemConfig
    │   └── migrations/             Migration history
    └── src/
        ├── index.js                Express app entry
        ├── routes/
        │   ├── auth.js             POST /api/auth/google
        │   └── api.js              All authenticated routes
        ├── controllers/
        │   ├── authController.js   (live)
        │   ├── slotController.js   (live)
        │   ├── bookingController.js (live — OCC + idempotency + penalty tiers)
        │   └── adminController.js  (stub → Phase 6)
        └── middleware/
            ├── auth.js             verifySession, requireRole, requireAigScope (live)
            └── rateLimiter.js      10s / 8 req cap on POST /api/bookings (live)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Routing | React Router DOM 7 (HashRouter for GH Pages) |
| Styling | Tailwind CSS 3 + custom `gem-*` colour tokens |
| Charts | Recharts (PlacementAdminDashboard) |
| Icons | Lucide React |
| Backend | Node.js + Express 5 |
| ORM | Prisma 6 |
| Database (dev) | SQLite (`server/prisma/dev.db`) |
| Database (prod) | PostgreSQL (swap one line in `.env` + `schema.prisma`) |
| Auth | Google Identity Services → our own session JWT |
| Deploy (frontend) | GitHub Pages via `gh-pages` |
| Deploy (backend) | On-prem server (TBD) |

---

## User Roles & Routes

| Role | Route | View |
|---|---|---|
| `STUDENT` | `/student` | AIG accordion + mentor search |
| `STUDENT` | `/student/:group/:mentorId` | Slot list + booking bottom sheet |
| `MENTOR` | `/mentor` | Today's sessions + slot creation |
| `MENTOR` | `/mentor/cohort` | Cohort member tracker |
| `AIGs` | `/admin/:aigSlug` | AIG-scoped cohort control + CV freeze countdown |
| `SuperADMIN` | `/admin/placements` | Batch KPIs, charts, live ops, whitelist mgmt |
| — | `/login` | Google sign-in |
| — | `/unauthorized` | Access denied page |

---

## Key Design Decisions

**Whitelist gate** — `AccessWhitelist` is the sole access-control table. No email outside it can log in, even with a valid Google credential. `AIGs`-tier rows carry an `aigId` that scopes them to one AIG's admin view.

**Optimistic Concurrency Control** — `Slot.version` (integer, default 0) is the OCC counter. The booking controller reads the slot, runs all checks, then writes via `updateMany({ where: { id, version }, data: { version: { increment: 1 } } })`. A `count === 0` result means another request won the race; the controller retries up to 3 times then returns 409. No row locks, no serialisable transactions needed.

**Idempotency** — Every booking request carries a client-generated `idempotencyKey` (UUID). The controller checks for an existing `Booking` with that key before running OCC; a duplicate submission replays the existing booking instead of erroring.

**Ban policy tiers** — Thresholds and durations live in `BanPolicyTier` rows (seeded, not hardcoded). The booking controller reads the appropriate tier at runtime, making the policy adjustable without a code deploy.

**Cancellation penalty tiers**:
- ≥ 60 min before slot start → no penalty
- 30–59 min → `WARNING` (3 warnings auto-convert to 1 `STRIKE`)
- < 30 min / after start → `STRIKE` directly

**Mentor slug** — `MentorProfile.slug` (e.g. `evelyn-vance`) is server-generated at profile creation, stored in DB, and used in student URLs. Client code never derives the display name from the slug string.

**SystemConfig** — A key/value table (`cv_freeze_deadline`, `booking_open`) used for global settings that need to change without a schema migration. The AIG admin countdown reads `cv_freeze_deadline` as a UTC ISO string.

---

## Local Development Setup

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Configure the server
```bash
cp server/.env.example server/.env
# Edit server/.env:
#   - Set GOOGLE_CLIENT_ID (from Google Cloud Console)
#   - Set JWT_SECRET to a long random string
#   - DATABASE_URL is pre-set to SQLite for local dev
```

### 3. Run migrations and seed
```bash
cd server
npx prisma migrate dev
# Migration runs seed automatically on first run.
# To re-seed manually:
npx prisma db seed
```

### 4. Start both servers
```bash
# From repo root — runs client (port 3000) and server (port 4000) concurrently
npm run dev
```

Client proxies `/api/*` to `localhost:4000` via the Vite dev proxy.

### Switching to PostgreSQL (production)
1. In `server/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`
2. Update `DATABASE_URL` in `server/.env` to a PostgreSQL connection string
3. `npx prisma migrate deploy`

---

## Build & Deploy

### Frontend (GitHub Pages)
```bash
cd client
VITE_BASE_PATH=/slot-booking-platform/ npm run build
npm run deploy          # pushes dist/ to gh-pages branch
```

### Frontend (on-prem, base path = `/`)
```bash
cd client
npm run build           # VITE_BASE_PATH defaults to "/"
```

---

## Phase Plan

### ✅ Phase 1 — Rename + Route Refactor
**Status: Complete**

- Product name `Parthsaarthi` reflected in `index.html` title and page text throughout
- Full RBAC route map in `App.jsx`: `/student`, `/mentor`, `/admin/:aigSlug`, `/admin/placements`, `/login`, `/unauthorized`
- `RequireRole` guard component scaffolded (stub, passes all requests through — enforced in Phase 3)
- `TeamDishaDashboard` generalised to `AigAdminDashboard`: reads `aigSlug` from `useParams()`, formats AIG display name dynamically; hardcoded "Team Disha" strings removed
- `AdminDashboard` launcher shell deleted; `PlacementAdminDashboard` takes its place with the full charts/KPI/live-ops view
- `LoginPage` and `UnauthorizedPage` placeholder routes added
- `vite.config.js` base path made env-configurable via `VITE_BASE_PATH`; `/api` dev proxy pointed at `localhost:4000`

---

### ✅ Phase 2 — Prisma Schema + Server Scaffolding
**Status: Complete**

- Server dependencies installed: `express`, `@prisma/client`, `prisma`, `google-auth-library`, `jsonwebtoken`, `helmet`, `cors`, `compression`, `express-rate-limit`, `dotenv`, `nodemon`
- `server/prisma/schema.prisma` — 13 models, 3 enums:
  - `Role`: `STUDENT | MENTOR | AIGs | SuperADMIN`
  - `WarnType`: `WARNING | STRIKE`
  - `BookingStatus`: `CONFIRMED | CANCELLED | ATTENDED | NO_SHOW`
  - `AccessWhitelist`, `User`, `StudentProfile`, `MentorProfile` (with unique `slug`), `AIG` (with unique `slug`), `Cohort`, `BookingRelease`, `Slot` (with `version Int @default(0)`), `SlotCapacity`, `Booking` (with unique `idempotencyKey`), `StudentWarning`, `Ban`, `BanPolicyTier`, `AuditEvent`, `SystemConfig`
- Migration `20260620090422_init` applied successfully (SQLite dev database)
- Seed script (`prisma/seed.js`) — idempotent upserts:
  - 3 AIGs: `disha`, `consulting`, `finance`
  - 2 `AccessWhitelist` rows: `pgp41137@iiml.ac.in` (SuperADMIN), `disha-admin@iiml.ac.in` (AIGs/disha)
  - 3 `BanPolicyTier` rows: 1 strike → 24hr, 2 strikes → 72hr, 3 strikes → permanent
  - 2 `SystemConfig` rows: `cv_freeze_deadline = 2026-07-05T23:59:00.000Z`, `booking_open = true`
- Express app scaffolded (`src/index.js`) with helmet, cors, compression, error handler
- Route stubs: `routes/auth.js`, `routes/api.js` (all endpoints declared, rate limiter mounted on `/api/bookings`)
- Controller stubs: `authController`, `slotController`, `bookingController`, `adminController`
- Middleware stubs: `auth.js` (verifySession, requireRole, requireAigScope), `rateLimiter.js` (live)

> **Note on Prisma version:** npm resolved Prisma 7.8.0, which removes `url` from `schema.prisma` in favour of a TypeScript config file — incompatible with our CommonJS setup. Pinned to **Prisma 6.19.3**. Prisma 7 migration is a separate future decision.

---

### ✅ Phase 3 — Authentication
**Status: Complete**

Scope:
- **Server** — `authController.googleSignIn`:
  - Accept `{ idToken }` from frontend (Google Identity Services)
  - Verify with `google-auth-library` `OAuth2Client.verifyIdToken()`
  - Reject with 403 if email absent from `AccessWhitelist`
  - `prisma.user.upsert()` with role copied from whitelist row
  - Sign and return our own session JWT (`{ sub, role, aigId? }`)
- **Server** — `middleware/auth.js`:
  - `verifySession`: verify session JWT on every `/api` request, attach `req.user`
  - `requireRole(...roles)`: return 403 if `req.user.role` not in allowed list
  - `requireAigScope(slugParam)`: return 403 if `req.user.aigSlug !== req.params[slug]`
- **Frontend** — `AuthContext`:
  - State: `{ user, role, login(idToken), logout() }`
  - Wrap `App.jsx` in provider
  - Store session JWT in `sessionStorage`
- **Frontend** — `LoginPage`:
  - Load Google Identity Services script
  - On credential callback: `POST /api/auth/google` → store token → navigate to role-appropriate dashboard
- **Frontend** — `RequireRole`:
  - Read role from `AuthContext`
  - Redirect to `/unauthorized` on mismatch, `/login` if unauthenticated
- **Frontend** — `apiClient.js`:
  - Fetch wrapper that attaches session JWT from `sessionStorage`
  - Handles 401 → clear auth state → redirect to `/login`

---

### ✅ Phase 4 — Booking API + OCC
**Status: Complete**

Scope:
- **`slotController`**:
  - `GET /api/aigs` — list AIGs with mentor count
  - `GET /api/aigs/:slug` — single AIG (name, type) for `AigAdminDashboard` header
  - `GET /api/mentors?aigSlug=disha` — list mentors with live slot count
  - `GET /api/mentors/:slug` — single mentor profile (name, firm, domain, cohortId)
  - `GET /api/slots?mentorSlug=evelyn-vance` — list slots; tags each with `AVAILABLE | BOOKED_BY_ME | BOOKED_BY_OTHER` using `req.user.id`
  - `POST /api/slots` (MENTOR) — create `BookingRelease` + generate individual `Slot` + `SlotCapacity` rows for each time interval
  - `DELETE /api/slots/:id` (MENTOR) — delete if no active bookings
  - `GET /api/cohort` (MENTOR) — load cohort + members scoped to `req.user`'s `mentorProfile.cohortId`
- **`bookingController`**:
  - `POST /api/bookings` (STUDENT, rate-limited):
    1. Check `idempotencyKey` — replay if existing
    2. Check active ban
    3. Read `slot.version`
    4. Capacity + cohort-eligibility checks
    5. `updateMany({ where: { id, version }, data: { version: { increment: 1 } } })`
    6. `count === 0` → retry up to 3×, then 409
    7. On success: create `Booking` + increment `SlotCapacity.current` + write `AuditEvent` in a transaction
  - `DELETE /api/bookings/:id/release` (STUDENT) — cancel with penalty tier evaluation
  - `POST /api/bookings/:id/attendance` (MENTOR) — mark `ATTENDED` or `NO_SHOW`; no-show → `STRIKE` → evaluate `BanPolicyTier` → auto-ban if threshold met

---

### 🔲 Phase 5 — Frontend API Integration
**Status: Pending**

Replace all hardcoded mock data with real API calls. Add loading, error, and empty states (currently absent — mock data is always present).

Per-view changes:
- **`StudentDashboard`** — fetch `GET /api/aigs` (accordion list + mentor counts); fetch `GET /api/mentors?aigSlug=X` on expand
- **`MentorBookingView`** — fetch `GET /api/mentors/:slug` on mount (name, firm, domain); fetch `GET /api/slots?mentorSlug=X`; generate `idempotencyKey` once per bottom-sheet open (reuse on retry taps to prevent double-booking); on 409 response refetch slots and show "Someone just booked this — here are the remaining slots"
- **`MentorDashboard`** — fetch today's `Booking` list + `Slot` list for the authenticated mentor; slot creation bottom sheet calls `POST /api/slots`; Attended/No-Show buttons call `POST /api/bookings/:id/attendance`
- **`MentorCohortDetails`** — fetch `GET /api/cohort`; download button calls CSV export endpoint
- **`AigAdminDashboard`** — fetch `GET /api/aigs/:slug` for display name + `GET /api/admin/aig/:aigSlug` for cohort data and at-risk students; replace hardcoded CV freeze countdown with live countdown computed from `SystemConfig.cv_freeze_deadline`
- **`PlacementAdminDashboard`** — fetch `GET /api/admin/batch` for KPIs and chart data

---

### 🔲 Phase 6 — Admin & Whitelist Management UI
**Status: Pending**

Scope:
- **`adminController`** implementations:
  - `GET /api/admin/aig/:aigSlug` — cohort list + at-risk students + batch readiness % scoped to one AIG
  - `GET /api/admin/batch` — cross-AIG KPIs, mentor utilisation, purpose distribution
  - `GET/POST/DELETE /api/admin/whitelist` — whitelist CRUD (SuperADMIN only)
  - `GET/PUT /api/admin/config` — read and update `SystemConfig` entries
  - CSV export endpoint for `PlacementAdminDashboard`
- **`PlacementAdminDashboard`** whitelist section:
  - Table of current whitelist entries (email, role, AIG scope, added by, date)
  - Add entry form: email + role selector + optional AIG dropdown
  - Remove entry (cannot remove own SuperADMIN row)
  - Update `cv_freeze_deadline` and `booking_open` via the config endpoint
- **Ban management** (SuperADMIN):
  - List active bans with student details
  - Manual lift: `PATCH /api/admin/bans/:id/lift`

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | `server/.env` | `file:./prisma/dev.db` (dev) or PostgreSQL URL (prod) |
| `JWT_SECRET` | `server/.env` | Long random string for signing session JWTs |
| `JWT_EXPIRES_IN` | `server/.env` | e.g. `8h` — session lifetime |
| `GOOGLE_CLIENT_ID` | `server/.env` | OAuth 2.0 client ID from Google Cloud Console |
| `PORT` | `server/.env` | Server port (default 4000) |
| `CLIENT_ORIGIN` | `server/.env` | Frontend URL for CORS allow-origin |
| `VITE_BASE_PATH` | build env | `/slot-booking-platform/` for GH Pages, `/` for on-prem |
