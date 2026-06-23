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

### ✅ Phase 5 — Frontend API Integration
**Status: Complete**

Replace all hardcoded mock data with real API calls. Added loading, error, and empty states throughout.

Per-view changes:
- **`StudentDashboard`** — fetches `GET /api/aigs` (accordion list + mentor counts); lazy-loads `GET /api/mentors?aigSlug=X` on expand; all-mentor fetch on first search keystroke
- **`MentorBookingView`** — fetches `GET /api/mentors/:slug` + `GET /api/slots?mentorSlug=X` in parallel; generates `idempotencyKey` once per bottom-sheet open (reused on retry taps to prevent double-booking); 409 silently refreshes slot list
- **`MentorDashboard`** — fetches `GET /api/slots/mine` for today's sessions + available slots; slot creation calls `POST /api/slots`; Attended/No-Show buttons call `POST /api/bookings/:id/attendance`
- **`MentorCohortDetails`** — fetches `GET /api/cohort`; member list with real attendance status
- **`AigAdminDashboard`** — fetches `GET /api/admin/aig/:aigSlug` for cohort data, batch readiness %, at-risk students; live CV freeze countdown from `SystemConfig.cv_freeze_deadline`
- **`PlacementAdminDashboard`** — fetches `GET /api/admin/batch` for KPIs and chart data

---

### ✅ Phase 6 — Admin & Whitelist Management UI
**Status: Complete**

- **`adminController`** — all functions fully implemented:
  - `GET /api/admin/aig/:aigSlug` — cohort list + at-risk students + batch readiness % scoped to one AIG
  - `GET /api/admin/batch` — cross-AIG KPIs, mentor utilisation, purpose distribution, recent audit events
  - `GET/POST/DELETE /api/admin/whitelist` — whitelist CRUD (SuperADMIN only); `addedBy` tracked per entry
  - `GET/PUT /api/admin/config` — read and update `SystemConfig` entries
- **`PlacementAdminDashboard`** — three-tab layout:
  - **Overview**: KPI cards, Milestone Focus pie chart, Mentor Utilization bar chart, live audit events table
  - **Whitelist**: add/remove entries with email + role + optional AIG scope; cannot remove own row
  - **Config**: booking window toggle + CV freeze deadline datetime picker

---

### ✅ Phase 7 — Demo Seed + Ban Management
**Status: Complete**

**Rich demo seed** (`server/prisma/seed.js`):
- 3 demo cohorts: `Q4` (disha), `Summer Batch` (consulting), `Finance Track` (finance)
- 3 mentor users with whitelist entries and `MentorProfile` rows:
  - Evelyn Vance — McKinsey & Co. — slug `evelyn-vance` — disha / Q4 cohort
  - Arjun Mehta — Bain & Company — slug `arjun-mehta` — consulting / Summer Batch
  - Priya Sharma — Goldman Sachs — slug `priya-sharma` — finance / Finance Track
- 3 student users with whitelist entries and `StudentProfile` rows in the Q4 cohort (PGP 25101, 25089, 25125)
- 4 upcoming 15-minute slots for Evelyn Vance (tomorrow 2:00–3:00 PM) with `SlotCapacity`
- 1 confirmed booking: Rohan Gupta → Evelyn Vance slot 1 (focus=overall, idempotency-keyed)
- 1 active ban: Kabir Khan (demo strike, expires 24 hours from seed run)
- All seed operations are idempotent — safe to re-run via `npx prisma db seed`

**Ban management** (SuperADMIN):
- `GET /api/admin/bans` — list all active (not-lifted, not-expired) bans with student name + email + reason + expiry
- `PATCH /api/admin/bans/:id/lift` — lift a ban immediately; records `liftedBy` email + `BAN_LIFTED` audit event
- **Bans tab** in `PlacementAdminDashboard` — table of active bans with "Lift Ban" button per row; live count badge

**Bug fix**: `addToWhitelist` controller was missing `addedBy` (required schema field); now populated from `req.user.email`.

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | `server/.env` | `file:./prisma/dev.db` (dev) or PostgreSQL URL (prod) |
| `JWT_SECRET` | `server/.env` | Long random string for signing session JWTs |
| `JWT_EXPIRES_IN` | `server/.env` | e.g. `8h` — session lifetime |
| `GOOGLE_CLIENT_ID` | `server/.env` | OAuth 2.0 client ID from Google Cloud Console |
| `AUTH_MODE` | `server/.env` | `dev` (email bypass) or omit for production Google OAuth |
| `PORT` | `server/.env` | Server port (default 4000) |
| `CLIENT_ORIGIN` | `server/.env` | Frontend URL for CORS allow-origin |
| `SMTP_HOST` | `server/.env` | SMTP server hostname (omit to log emails to console) |
| `SMTP_PORT` | `server/.env` | SMTP port, e.g. `587` |
| `SMTP_SECURE` | `server/.env` | `true` for port 465 (TLS), `false` for STARTTLS |
| `SMTP_USER` | `server/.env` | SMTP authentication username |
| `SMTP_PASS` | `server/.env` | SMTP authentication password |
| `SMTP_FROM` | `server/.env` | Sender address, e.g. `Parthsaarthi <noreply@iiml.ac.in>` |
| `VITE_BASE_PATH` | build env | `/slot-booking-platform/` for GH Pages, `/` for on-prem |

---

## Production Deployment Guide

All features are built and tested. The remaining steps before go-live are infrastructure and credentials — no feature development is outstanding.

### Pre-deployment Checklist

- [ ] Google Cloud Console OAuth client ID obtained (see below)
- [ ] PostgreSQL database provisioned (Supabase / Neon / Railway all work)
- [ ] SMTP credentials ready (IIM mail relay or transactional service like Resend/Postmark)
- [ ] Server host decided (VPS, Railway, Render, etc.)
- [ ] Custom domain / SSL certificate in place

---

### Step 1 — Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add your production domain to **Authorised JavaScript origins** (e.g. `https://parthsaarthi.iiml.ac.in`)
4. No redirect URIs needed — this app uses the GSI one-tap / popup flow
5. Copy the **Client ID**

In `server/.env` (production):
```
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
# Remove or do NOT set AUTH_MODE — omitting it enables real OAuth
```

In `client/src/pages/LoginPage.jsx`, swap the dev email input for the real Google button:
```jsx
// Replace the dev <input type="email"> form with:
<div
  id="g_id_onload"
  data-client_id="YOUR_CLIENT_ID"
  data-callback="handleGoogleCredential"
  data-auto_prompt="false"
/>
<div className="g_id_signin" data-type="standard" />
```
Then add the GSI script tag to `client/index.html`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```
The server's `authController.js` already handles `idToken` verification via `google-auth-library` when `AUTH_MODE` is not `dev`.

---

### Step 2 — PostgreSQL Setup

1. Provision a Postgres database (Supabase free tier works for this scale)
2. Copy the connection string — looks like:
   ```
   postgresql://user:password@host:5432/dbname?sslmode=require
   ```
3. In `server/.env`:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
   ```
4. The `connection_limit=1` SQLite hack in `server/src/lib/prisma.js` only applies to `file:` URLs — PostgreSQL uses Prisma's default pooling automatically
5. Run migrations on the production DB:
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma db seed
   ```
   `migrate deploy` applies all migrations without resetting data. `db seed` is safe to run once to bootstrap SystemConfig, AIGs, BanPolicyTiers, and the initial SuperADMIN whitelist entry.

---

### Step 3 — SMTP Email Setup

In `server/.env`:
```
SMTP_HOST=smtp.gmail.com        # or your institution's relay
SMTP_PORT=587
SMTP_SECURE=false               # true for port 465
SMTP_USER=noreply@iiml.ac.in
SMTP_PASS=your-app-password
SMTP_FROM=Parthsaarthi <noreply@iiml.ac.in>
```
If using Gmail, generate an **App Password** (not your account password) under Google Account → Security → 2-Step Verification → App passwords.

The mailer already sends:
- Running-late alerts to booked students when a mentor sets a delay
- Late-cancellation notice to the mentor when a student cancels with a penalty
- 30-minute reminders to both parties before each session
- Daily 8 AM digest to each AIG admin listing at-risk students

---

### Step 4 — Build & Serve

The simplest production topology is Express serving the Vite build from the same origin, which avoids CORS entirely:

```bash
# 1. Build the client
cd client
VITE_BASE_PATH=/ npm run build
# Output lands in client/dist/

# 2. Copy the build to server's public folder (or configure Express to serve it)
cp -r dist/ ../server/public/

# 3. In server/src/index.js, add static file serving BEFORE api routes:
#    app.use(express.static(path.join(__dirname, "../../client/dist")));
#    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "../../client/dist/index.html")));
```

**Alternatively**, use an nginx reverse proxy:
```nginx
server {
    listen 443 ssl;
    server_name parthsaarthi.iiml.ac.in;

    # Serve the built React app
    root /var/www/parthsaarthi/client/dist;
    index index.html;

    # All non-/api requests → React (HashRouter handles routing client-side)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API requests → Express on port 4000
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### Step 5 — Process Management (PM2)

```bash
npm install -g pm2

cd server
pm2 start src/index.js --name parthsaarthi-api \
  --env production \
  --max-memory-restart 512M

# Auto-restart on server reboot
pm2 startup
pm2 save
```

Logs:
```bash
pm2 logs parthsaarthi-api
pm2 monit
```

---

### Step 6 — Production `.env` Template

**Server** (`server/.env`):
```bash
DATABASE_URL=postgresql://user:pass@host:5432/parthsaarthi?sslmode=require
JWT_SECRET=<64-char random hex — run: openssl rand -hex 32>
JWT_EXPIRES_IN=8h
GOOGLE_CLIENT_ID=<from Google Cloud Console>
# AUTH_MODE must NOT be set — its absence enables real Google OAuth
PORT=4000
CLIENT_ORIGIN=https://parthsaarthi.iiml.ac.in
# DEV_EMAIL_OVERRIDE must NOT be set — remove it so each user gets their own emails

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=<16-char Gmail App Password>
SMTP_FROM=Parthsaarthi <your@gmail.com>
```

**Client** (`client/.env`):
```bash
VITE_GOOGLE_CLIENT_ID=<same client ID as server>
```

> See `server/.env.example` and `client/.env.example` for full annotated templates.

---

### ⚠️ Production Readiness Checklist

Go through every item before switching traffic to production.

#### Must fix — app breaks or is insecure without these

| # | What | Why it fails |
|---|------|-------------|
| 1 | Remove `AUTH_MODE=dev` from server `.env` | With it set, **any email can log in** without a Google credential — no token verification happens |
| 2 | Set `GOOGLE_CLIENT_ID` (server + client) | Server: token verification throws. Client: Google button never renders — users see a blank login card |
| 3 | Set `CLIENT_ORIGIN` to production domain | CORS blocks every browser request — all API calls fail before reaching any route |
| 4 | Remove `DEV_EMAIL_OVERRIDE` | All booking confirmations, reminders, and digests go to one inbox; real users get nothing |
| 5 | Change `JWT_SECRET` to a random 64-char string | The dev default is known; anyone can forge a SuperADMIN token |
| 6 | Wire `/api` proxy or serve client from Express | Vite's dev proxy doesn't exist in the production build — relative `/api` calls will 404 unless nginx forwards them or Express serves the static files |
| 7 | Switch to PostgreSQL + run migrations | SQLite is ephemeral on container platforms (wiped on every deploy). `prisma db push` has no migration history — `prisma migrate deploy` fails in CI |

#### Feature failures — runs but key flows break

| # | What | Why it matters |
|---|------|---------------|
| 8 | No rate limit on `POST /api/auth/google` | Attacker can enumerate which emails are in the whitelist (403 vs. success) |
| 9 | Attendance marking has no time gate | Mentors can mark NO_SHOW days or weeks after a session — no protection against retroactive penalties |
| 10 | JWT expires in 8h, no refresh | Student mid-booking at the 8h mark gets a 401, loses their slot claim, and is redirected to login |
| 11 | Token in `sessionStorage` | Session lost when the browser tab closes — users re-login every time they reopen the browser (especially painful on mobile) |

#### Reliability

| # | What | Why it matters |
|---|------|---------------|
| 12 | No SIGTERM handler | PM2 restarts kill in-flight DB transactions — SlotCapacity can drift out of sync with Booking rows |
| 13 | No React error boundaries | Any uncaught component error (bad API response shape, `.map()` on null) renders a blank white screen with no way to recover |
| 14 | Email failures are fully silent | `.catch(() => {})` on booking/cancel emails means SMTP failures produce no log entry and no retry |
| 15 | `node-cron` runs in-process | If the server restarts at 07:59 IST, the 8 AM digest is skipped until the next day |
| 16 | `dev.db` tracked in git | Binary file with real seed email addresses; grows with every seed run |

#### Quick fixes for items 12, 13, 14

**Add SIGTERM handler** — append to `server/src/index.js`:
```js
process.on("SIGTERM", () => {
  server.close(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
});
```

**Add React error boundary** — wrap `<App />` in `main.jsx` with a simple boundary:
```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{padding:40,textAlign:"center"}}>
        <h2>Something went wrong</h2>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}
```

**Log email failures** — replace `.catch(() => {})` with `.catch((e) => console.error("[mailer]", e.message))` in `bookingController.js`.

---

### ✅ Phase 8 — Notifications, Exports, Profile & Config (complete)

**Email notifications** (`server/src/lib/mailer.js` + `scheduler.js`):
- Running-late alerts to all confirmed students when mentor sets a delay
- Late-cancellation email to mentor when student cancels with penalty applied
- 30-minute session reminders for student + mentor (cron, AuditEvent-deduped)
- Daily 8 AM digest to each AIG admin listing at-risk students
- Dev mode: emails logged to console; set `SMTP_HOST` to enable real delivery

**CSV exports** (`server/src/controllers/exportController.js`):
- `GET /api/cohort/export` (MENTOR) — cohort CSV with slot count, attendance, ban status
- `GET /api/admin/export/roster` (SuperADMIN) — full batch CSV with 12 columns per student

**Profile editing** (`server/src/controllers/profileController.js` + `client/src/pages/ProfileSettings.jsx`):
- All roles: edit display name
- MENTOR: also edit firm and domain
- Name change syncs back to AuthContext / sessionStorage without re-login
- "Edit Profile" link in AvatarMenu dropdown (all roles)

**Configurable penalty thresholds** (SystemConfig-driven):
- `penalty_warning_minutes` (default 60) — cancel ≥ this → no penalty
- `penalty_strike_minutes` (default 30) — cancel < this → immediate strike
- `penalty_warning_to_strike` (default 3) — N warnings → escalated to strike
- Editable in PlacementAdmin → Config tab with per-field Save buttons

**Audit log detail column** — PlacementAdmin Overview tab parses `event.meta` JSON to show human-readable context (e.g. "Released 4 slots", "Penalty: STRIKE", "Lifted by admin@iiml.ac.in")

**AIG Admin notification bell** — clicking scrolls to the Intervention Required section
