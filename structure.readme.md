# Parthsaarthi — Structural Architecture Reference

## 1. Folder Tree

```
slot-booking-platform/
├── package.json                  # root workspace manifest
├── package-lock.json
├── README.md / README.local.md / README.deployment.md / README.pwa.md
├── CHANGE_MANAGEMENT.md           # append-only release log
├── db_backups/                    # timestamped Postgres .dump snapshots (gitignored pattern, but tracked here)
├── docs/
│   └── student-guide/             # PDF + screenshots, end-user doc, not code
│
├── client/                        # React SPA (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── .env / .env.example
│   ├── public/                    # static assets served as-is (favicon, icons)
│   └── src/
│       ├── main.jsx                # entry point, mounts <App/>
│       ├── App.jsx                 # route table (react-router-dom v7)
│       ├── App.css / index.css
│       ├── assets/                 # images/logos imported by components
│       ├── components/             # shared, cross-page components
│       │   └── ui/                 # design-system primitives (Button, Card, Input, ...)
│       ├── context/                 # React Context (auth)
│       ├── hooks/                   # TanStack Query hooks (data layer)
│       ├── lib/                     # framework-agnostic helpers (apiClient, queryClient, roleHome, venues)
│       └── pages/                   # route-level screens, one per role/flow
│
└── server/                        # Express API (CommonJS)
    ├── package.json
    ├── .env / .env.example
    ├── public/                     # built client (deploy target — gitignored, copied here from client/dist)
    ├── public_backup_YYYYMMDD-HHMMSS/   # rollback snapshots of public/ (local, not committed)
    ├── scripts/
    │   └── stress-test.mjs
    ├── prisma/
    │   ├── schema.prisma
    │   ├── seed.js
    │   ├── migrations/              # one timestamped folder per migration, + migration_lock.toml
    │   └── prisma/dev.db            # local SQLite dev database
    └── src/
        ├── index.js                 # app bootstrap: middleware, routing, static serving, error handler
        ├── routes/                  # auth.js (public) + api.js (all authenticated routes)
        ├── controllers/              # one file per resource area (slot, booking, admin, export, profile, auth)
        ├── middleware/                # auth.js (JWT/role/scope guards), rateLimiter.js
        └── lib/                      # prisma client singleton, mailer, calendarInvite, cron scheduler
```

## 2. Monorepo / Project Layout

- **npm workspaces** monorepo, two packages: `client` and `server` (declared in root [package.json](package.json)).
- No Turborepo/Nx/pnpm/yarn — plain npm workspace scripts (`dev`, `dev:client`, `dev:server`, `install:all`) run each workspace via `--workspace=`.
- No shared/internal package exists between client and server (no `packages/` dir) — they are two independent apps that only meet at the HTTP boundary.

**Root-level config files:**
| File | Purpose |
|---|---|
| [package.json](package.json) | Workspace root; declares `client`/`server` workspaces and root dev scripts |
| [package-lock.json](package-lock.json) | Single lockfile for the whole workspace tree |
| `.claude/settings.json`, `.claude/settings.local.json` | Claude Code project settings (not app config) |
| `CHANGE_MANAGEMENT.md` | Manual changelog, one entry required per production release |
| `README.deployment.md` | Deployment runbook (PM2 + Apache reverse-proxy on Windows Server) |
| `README.local.md`, `README.pwa.md`, `README.md` | Setup/PWA notes |

No CI files (`.github/workflows`, etc.), no Dockerfile, no `tsconfig.json`/`jsconfig.json` — this is a plain JS (not TypeScript) codebase with manual deployment.

## 3. Frontend Structure (`client/src`)

- **Routing:** `react-router-dom` v7, single route table in [App.jsx](client/src/App.jsx). Nested `<Route>` elements gate by role via a layout-style guard component (`RequireRole`) rather than per-page checks. Route-level page transitions are applied via a `PageTransition` wrapper (`t(...)` helper), deliberately never wrapped around layout routes.
- **Components (`components/`):** cross-cutting shared components at the top level (`AppFooter`, `AvatarMenu`, `CollapsibleSection`, `RequireRole`). `components/ui/` is a self-contained design-system layer (Button, Card, Badge, Input, Sheet, Skeleton, Toggle, IconButton, PageHeader, AppShell, PageTransition, TimeField) re-exported through `ui/index.js` for single-import consumption.
- **Pages (`pages/`):** one file per route/screen, named by role + function (`StudentDashboard`, `MentorDashboard`, `AigAdminDashboard`, `PlacementAdminDashboard`, `CreateSlotsFlow`, `RescheduleSlot`, etc.). `StudentLayout` is a nested-route layout (renders `<Outlet/>` for the student section).
- **State management:**
  - Server state: **TanStack React Query** (`@tanstack/react-query`), centralized in [hooks/useApi.js](client/src/hooks/useApi.js) — a single file exporting all `useQuery`/`useMutation` hooks plus a `QK` (query-key) registry object so cache invalidation stays consistent across mutations.
  - Client/session state: **React Context**, split into `AuthContext.jsx` (provider/logic), `auth-context.js` (the `createContext` instance itself), and `useAuth.js` (consumer hook) — a 3-file pattern that keeps Fast Refresh happy (only components in the same file as a context export).
  - No Redux/Zustand/Jotai.
- **Services/API layer (`lib/`):** `apiClient.js` (fetch wrapper: JWT attach, silent token refresh, 401 handling, CSV `downloadFile`), `queryClient.js` (the single `QueryClient` instance), `roleHome.js`, `venues.js` (small domain lookup helpers).
- **Types:** none — plain JS/JSX, no TypeScript, no PropTypes observed.
- **Styles/assets:** Tailwind CSS (v3 config file, though root devDependency pins v4 — worth flagging), custom theme in [tailwind.config.js](client/tailwind.config.js) ("Forest & Brass" palette), global styles in `index.css`/`App.css`, static images in `src/assets/`, public static files (favicon/icons) in `client/public/`.
- **Build tool:** Vite ([vite.config.js](client/vite.config.js)) with a configurable `base` path (`VITE_BASE_PATH`) for subpath deployment, and a dev-server proxy of `/api` → `localhost:4000`.

## 4. Backend / Database Structure (`server`)

- **Framework:** Express 5, CommonJS (`require`/`module.exports` throughout, `"type": "commonjs"` in package.json).
- **Layering:** `routes/` → `middleware/` → `controllers/` → `lib/prisma.js`. No separate "services" or "repository" layer — controllers call Prisma directly.
  - `routes/auth.js`: public auth endpoints (Google OAuth exchange, refresh, dev-mode login).
  - `routes/api.js`: single router mounting every authenticated resource (`/profile`, `/aigs`, `/mentors`, `/slots`, `/bookings`, `/cohort`, `/admin/*`), gated per-route by `requireRole(...)` and scope guards (`requireAigScope`, `requireMentorAigScope`) from `middleware/auth.js`.
  - `controllers/`: one file per resource area — `slotController`, `bookingController`, `adminController`, `exportController`, `profileController`, `authController`.
  - `middleware/`: `auth.js` (JWT verification + RBAC), `rateLimiter.js` (e.g. `bookingRateLimiter`).
  - `lib/`: `prisma.js` (singleton Prisma Client), `mailer.js` (nodemailer wrapper), `calendarInvite.js` (.ics generation), `scheduler.js` (`node-cron` background jobs, started from `index.js`).
- **Entry point:** [server/src/index.js](server/src/index.js) — wires helmet/CORS/compression/JSON body parsing, mounts routers under an optional `BASE_PATH` (reverse-proxy subpath support), serves the built SPA from `server/public/` as a catch-all, centralized error handler, graceful `SIGTERM` shutdown, and starts the cron scheduler.
- **Database / ORM:** Prisma, schema at [server/prisma/schema.prisma](server/prisma/schema.prisma). Provider is switched manually between SQLite (dev, `prisma/dev.db`) and PostgreSQL (production) per `.env`/`DATABASE_URL` — see `README.deployment.md` for the exact swap procedure.
- **Migrations:** `server/prisma/migrations/`, one timestamp-prefixed folder per migration (each with a `migration.sql`), plus `migration_lock.toml`. Migration history tracks the schema's evolution (org/category fields, slot publishing, reschedule/waitlist, cancellation redesign, roles/slot-types, etc.).
- **Seeding:** `server/prisma/seed.js`, wired via the `"prisma": { "seed": ... }` field in `server/package.json` (`npm run db:seed`).
- **Schema shape (models, for orientation only):** `AccessWhitelist`, `User`, `StudentProfile`, `MentorProfile`, `AIG`, `Cohort`, `BookingRelease`, `Slot`, `SlotWaitlist`, `SlotCapacity`, `Booking`, `StudentWarning`, `Ban`, `BanPolicyTier`, `AuditEvent`, `SystemConfig`; enums `Role`, `BookingStatus`, `SlotType`, `ParticipantRole`, `WarnType`, `OrgCategory`, `MentorType`.
- **No serverless/edge functions** — this is a monolithic long-running Node process (deployed under PM2), not a functions-based architecture.
- **Shared types / API contract:** none formalized. There's no OpenAPI spec, no shared `types/` package, no codegen. The frontend and backend agree on shapes implicitly — `client/src/lib/apiClient.js` calls REST JSON endpoints matching the routes in `server/src/routes/api.js` by convention/documentation comments only.

## 5. Shared Code

- **No shared package** exists between `client` and `server` — no `packages/shared`, no path-aliased cross-package imports. Each workspace has its own `node_modules` and dependency set.
- Within `client/src`, the closest thing to a "shared" layer is `components/ui/` (design-system primitives, imported via `import { Button } from "../components/ui"` using the barrel `ui/index.js`) and `lib/` (framework-agnostic helpers). All imports are **relative paths** (`../`, `./`) — no path aliases (`@/`, `~/`) are configured in Vite or ESLint.
- Within `server/src`, the closest analog is `lib/` (prisma client singleton, mailer, scheduler) — imported by controllers via relative `require("../lib/...")`.

## 6. Conventions Observed

- **Files/folders:**
  - React components: `PascalCase.jsx` (e.g. `MentorDashboard.jsx`, `RequireRole.jsx`), one component per file, matching the exported name.
  - Non-component JS modules: `camelCase.js` (e.g. `apiClient.js`, `roleHome.js`, `auth-context.js` is the one kebab-case outlier, likely to visually distinguish the context *instance* file from the `AuthContext.jsx` *provider component*).
  - Server files: `camelCase.js` throughout (`slotController.js`, `rateLimiter.js`).
  - Folders are lowercase, singular-by-concept (`hooks`, `context`, `lib`, `controllers`, `middleware`, `routes`).
- **Tests:** none found in the repo (no `*.test.js`, `*.spec.js`, no test runner configured in either `package.json`). Correctness currently relies on manual QA and the deployment runbook's verification steps, plus `server/scripts/stress-test.mjs` for load testing.
- **Environment config:** `.env` + `.env.example` pairs per workspace (`client/.env.example`, `server/.env.example`), never committed with real values (`.env` itself is gitignored, only the `.example` is tracked). Server env covers DB provider/URL, JWT secret/expiry, Google OAuth client ID, `AUTH_MODE=dev` escape hatch, SMTP, `PORT`, `CLIENT_ORIGIN`, `BASE_PATH`. Client env covers `VITE_GOOGLE_CLIENT_ID` only (all other frontend config is baked in at build time via `VITE_BASE_PATH`).
- **Linting:** ESLint flat config (`client/eslint.config.js`) with `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`; no Prettier config present. No linter configured for `server/`.

## 7. Deployment Config

- **No containerization** (no Dockerfile/docker-compose) and **no CI/CD pipeline** (no `.github/workflows`). Deployment is manual, documented step-by-step in [README.deployment.md](README.deployment.md).
- **Target environment:** a single Windows Server host, process-managed by **PM2**, fronted by an **Apache reverse proxy** mounting the app at a subpath (`/parthsaarthi`).
- **Build artifact flow:** `client` is built with Vite (`VITE_BASE_PATH=/parthsaarthi/ npm run build`) → output copied into `server/public/` (gitignored) → Express serves it as static files + SPA fallback from [server/src/index.js](server/src/index.js).
- **Environment separation:** purely via `.env` files per workspace, not distinct config directories — `NODE_ENV`, `AUTH_MODE`, `DATABASE_URL` (SQLite locally vs Postgres in prod), and `BASE_PATH`/`VITE_BASE_PATH` are the switches between local dev and production.
- **Rollback safety net:** timestamped `server/public_backup_<timestamp>/` folders (local only, not committed) are made before every overwrite of `server/public/`.
- **DB backups:** `db_backups/` holds `pg_dump --format=custom` snapshots, committed to git before any schema/data change, per the runbook's mandatory pre-migration snapshot step.
