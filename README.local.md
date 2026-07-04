# Running Parthsaarthi Locally

Quick-start guide for getting the app running on your own machine for development.
For production deployment, see `README.deployment.md` instead — do not follow this
guide against a production database.

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

---

## 1. Install dependencies

From the repo root (this installs both `client` and `server` workspaces):

```bash
npm run install:all
```

---

## 2. Configure the server environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

- `DATABASE_URL` — already pre-set to SQLite (`file:./prisma/dev.db`), no change needed
- `JWT_SECRET` — set to a long random string (`openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID` — from Google Cloud Console, **or** skip real OAuth entirely by uncommenting:
  ```
  AUTH_MODE=dev
  ```
  In dev mode, the login page accepts any whitelisted email directly, no Google credential needed.
- `CLIENT_ORIGIN` — leave as `http://localhost:3000`

Optional: `cp client/.env.example client/.env` if you want to test real Google sign-in
(`VITE_GOOGLE_CLIENT_ID` must match the server's `GOOGLE_CLIENT_ID`). Not needed if using `AUTH_MODE=dev`.

---

## 3. Run migrations and seed the database

```bash
cd server
npx prisma migrate dev
```

The seed script runs automatically the first time. To re-seed later (idempotent, safe to re-run):

```bash
npx prisma db seed
```

This creates demo AIGs, mentors, students, sample slots/bookings, and the initial
whitelist entries (including a `SuperADMIN`).

---

## 4. Start the app

From the repo root:

```bash
npm run dev
```

This runs both:
- **client** — Vite dev server on `http://localhost:3000`
- **server** — Express API on `http://localhost:4000`

The client's Vite dev proxy forwards `/api/*` to `localhost:4000`, so no CORS setup is needed.

Open **http://localhost:3000** in your browser.

---

## Logging in locally

With `AUTH_MODE=dev` set, the login page takes a plain email input instead of the
Google button. Use one of the seeded whitelist emails (check `server/prisma/seed.js`
for the current set, e.g. the seeded `SuperADMIN`/mentor/student addresses) to sign in
as that role.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login page shows a blank Google button | `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` not set and `AUTH_MODE=dev` not enabled |
| `403` on login even with a valid Google credential | Email isn't in `AccessWhitelist` — add it via seed or Prisma Studio |
| API calls 404 from the client | Server not running, or not on port 4000 — check `PORT` in `server/.env` |
| Emails not arriving | Expected in dev unless `SMTP_HOST` is set — emails are logged to the server console instead |
| Want to inspect/edit DB rows directly | `cd server && npx prisma studio` |

---

## Switching local dev to PostgreSQL

Only needed if you want to match production locally:

1. In `server/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`
2. Point `DATABASE_URL` in `server/.env` to a Postgres instance
3. `npx prisma migrate deploy`
