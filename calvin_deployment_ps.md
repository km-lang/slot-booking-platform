# Deployment Playbook — Parthsaarthi (slot-booking-platform)

> File name note: this is saved as `calvin_deployment_ps.md` per the request that created it.
> The application itself is **Parthsaarthi** (repo: `slot-booking-platform`), a mentor/student
> slot-booking platform. This file is meant to be handed to a fresh Claude Code session with
> no prior context and let it deploy the app correctly and safely.

**Stack at a glance:**
- Monorepo, npm workspaces: `client` (React + Vite SPA) and `server` (Express 5 + Prisma, CommonJS)
- DB: PostgreSQL in production (SQLite only for local dev) via Prisma ORM
- Process manager: **PM2** on a single Windows Server host
- Reverse proxy: **Apache**, mounting the app at a subpath — production path is `/parthsaarthi`
- No Docker, no CI/CD pipeline — everything below is done by hand on the host
- Client is built statically and copied into `server/public/`; Express serves it + the API from one process

Two authoritative docs already live in the repo — **read them, don't just read this summary**:
- [`README.deployment.md`](README.deployment.md) — the routine "ship new code" runbook (this file mirrors it, plus first-time setup)
- [`README.local.md`](README.local.md) — local dev setup (not for production)
- [`structure.readme.md`](structure.readme.md) — architecture reference
- [`CHANGE_MANAGEMENT.md`](CHANGE_MANAGEMENT.md) — append-only release log; every release needs an entry here

---

## ⚠️ Read this before touching anything

**Database safety is the #1 rule.** A routine "deploy the latest code" request means:
push code, build the client, swap the static files, restart PM2. It does **not** mean
touching the database — not `prisma migrate`, not `prisma db seed`, not `db push`, not a
manual SQL statement, not Prisma Studio edits — even if the diff happens to include a file
under `server/prisma/` (e.g. `seed.js`). Committing that file is fine; **executing** it
against production is not.

If a task genuinely requires a schema/data change:
1. Stop before running anything against the DB.
2. Ask the user for **explicit** permission, stating in plain words "this will change DB data."
3. Wait for an explicit yes, then ask a **second time**, naming exactly what will change
   (table/rows/migration name).
4. Only after two separate explicit confirmations, proceed — and always snapshot first (Step 0 below).

**Step 0 — snapshot before any DB change, no exceptions:**

```bash
TS=$(date +%Y%m%d-%H%M%S)
pg_dump "postgresql://postgres:<password>@localhost:5432/parthsaarthi" \
  --format=custom \
  --file="db_backups/parthsaarthi_${TS}.dump"

git add "db_backups/parthsaarthi_${TS}.dump"
git commit -m "chore: DB snapshot before <describe the change> (${TS})"
git push origin <branch>
```

Only after the snapshot is committed and pushed, and both confirmations are in hand, proceed
with the actual migration/seed/write.

---

## Part A — First-time deployment (new host / fresh checkout)

Use this only when the app is **not already running** on the target host. If PM2 already has
a process for this app, skip to **Part B (routine redeploy)** instead.

### A1. Prerequisites on the host

- Node.js ≥ 20, npm ≥ 10
- PostgreSQL server reachable from the host (existing production DB, or a fresh instance)
- PM2 installed globally: `npm install -g pm2`
- Apache installed and running, with `mod_proxy` / `mod_proxy_http` enabled (for the reverse
  proxy at `/parthsaarthi`)
- Git access to `git+https://github.com/km-lang/slot-booking-platform.git`

### A2. Clone and install

```bash
git clone https://github.com/km-lang/slot-booking-platform.git
cd slot-booking-platform
npm run install:all   # installs root + client + server workspaces
```

### A3. Configure environment files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env   # only needed for real Google OAuth
```

Edit `server/.env` for production values (see `server/.env.example` for the full annotated
list; the important ones):

| Var | Production value |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/parthsaarthi?schema=public&sslmode=require` |
| `JWT_SECRET` | long random string — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | e.g. `8h` |
| `GOOGLE_CLIENT_ID` | real OAuth client ID from Google Cloud Console (must match `client/.env`'s `VITE_GOOGLE_CLIENT_ID`) |
| `AUTH_MODE` | **must be unset/absent** — its presence enables the dev login bypass |
| `DEV_EMAIL_OVERRIDE` | **must be absent** in production |
| `PORT` | `4000` (matches what PM2/Apache expect below) |
| `CLIENT_ORIGIN` | the public origin, e.g. `https://parthsaarthi.iiml.ac.in` (no trailing slash) |
| `BASE_PATH` | `/parthsaarthi` (no trailing slash — the app prefixes routes and static serving with this) |
| `SMTP_*` | real SMTP creds, or emails just log to console |

Confirm `server/prisma/schema.prisma`'s `datasource db` block has `provider = "postgresql"`
(it already does in this repo — SQLite is only used by switching this locally per
`README.local.md`).

### A4. Provision the database (first time only)

This is a genuine DB-creating action — confirm with the user before running, per the safety
rules above, unless they've already explicitly asked for first-time provisioning.

```bash
cd server
npx prisma migrate deploy   # applies all committed migrations, does NOT create ad-hoc ones
npx prisma db seed          # idempotent — creates demo/whitelist rows; confirm with user if seeding prod is wanted at all
```

> On production, seeding may or may not be desired — some deployments only need the
> `AccessWhitelist`/`SuperADMIN` bootstrap rows, not demo data. Ask the user what the seed
> script actually inserts for their environment before running it against a real prod DB.

### A5. Build the client with the correct base path

```bash
cd client
rm -rf dist
MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/parthsaarthi/ npm run build
```

`MSYS_NO_PATHCONV=1` is required on **Windows with Git Bash** — otherwise MSYS mangles the
leading-slash env var into a Windows path. Verify the build actually baked in the right path:

```bash
grep -o '/parthsaarthi/assets/[^"]*' dist/index.html
```

If this doesn't show clean `/parthsaarthi/assets/...` paths, rebuild before proceeding.

### A6. Deploy the build into the server

```bash
cd ../server
mkdir -p public
cp -r ../client/dist/* public/
```

### A7. Start the app under PM2

```bash
cd server
pm2 start src/index.js --name parthsaarthi
pm2 save            # persist the process list across host reboots
pm2 startup         # (one-time, follow the printed OS-specific instructions to enable PM2 on boot)
```

### A8. Configure Apache as a reverse proxy at `/parthsaarthi`

Add to the Apache vhost config (path varies by install — typically under
`httpd.conf` or a `conf.d`/`sites-enabled` include):

```apache
ProxyPreserveHost On
ProxyPass /parthsaarthi http://localhost:4000/parthsaarthi
ProxyPassReverse /parthsaarthi http://localhost:4000/parthsaarthi
```

Reload/restart Apache after editing:

```bash
httpd -k restart   # or: apachectl graceful / systemctl reload apache2, depending on the host's Apache install
```

### A9. Verify

```bash
netstat -ano | grep ":4000"                                  # confirm PM2 process is listening
curl -s http://localhost:4000/parthsaarthi/ | grep -o '/parthsaarthi/assets/[^"]*'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/parthsaarthi/api/aigs   # 401 without auth = healthy
pm2 logs parthsaarthi --lines 30 --nostream
```

Then hit the public URL through Apache (e.g. `https://<host>/parthsaarthi/`) in a browser and
confirm login works.

### A10. Log it

Add an entry to [`CHANGE_MANAGEMENT.md`](CHANGE_MANAGEMENT.md) recording the initial deployment
(commit hash, date, "initial production deployment").

---

## Part B — Routine redeploy (app already running — the common case)

This is the day-to-day flow: ship new application code, no DB involved. Full detail lives in
[`README.deployment.md`](README.deployment.md); condensed here:

### B1. Confirm what's changing

```bash
git status
git diff --stat
```

Confirm `server/prisma/schema.prisma` is untouched and no new folder exists under
`server/prisma/migrations/`. If either changed, **stop** — that's a DB change; go to the
safety rules at the top of this doc instead of continuing here.

### B2. Stage, commit, push — only the intended files

```bash
git add <file1> <file2> ...   # never git add -A / git add .
git commit -m "descriptive message"
git push origin <branch>
```

A `server/prisma/seed.js` edit is fine to commit as source — just don't run it against prod.

### B3. Build the client

```bash
cd client
rm -rf dist
MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/parthsaarthi/ npm run build
grep -o '/parthsaarthi/assets/[^"]*' dist/index.html   # verify base path baked in correctly
```

### B4. Back up the currently-live build

```bash
cd ../server
TS=$(date +%Y%m%d-%H%M%S)
cp -r public "public_backup_$TS"
```

(`public/` and these backup folders are gitignored — local rollback safety nets only.)

### B5. Deploy the new build

```bash
rm -rf public/*
cp -r ../client/dist/* public/
ls public/
```

### B6. Identify which PM2 process actually owns the port

This host has a history of duplicate/stale PM2 entries pointing at the same script —
restarting the wrong one (or missing the live one) means the deploy silently doesn't take
effect.

```bash
pm2 list
netstat -ano | grep ":4000"   # match the PID in the LISTENING line back to pm2 list
```

If duplicates exist, **flag it to the user and ask** which to act on — don't unilaterally
delete/reconfigure PM2 processes.

### B7. Restart

```bash
pm2 restart <process-name(s)>
```

### B8. Verify

```bash
netstat -ano | grep ":4000"
curl -s http://localhost:4000/parthsaarthi/ | grep -o '/parthsaarthi/assets/[^"]*'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/parthsaarthi/api/aigs   # 401 expected/healthy
pm2 logs <process-name> --lines 15 --nostream
```

### B9. Log the release

Every release gets a row in [`CHANGE_MANAGEMENT.md`](CHANGE_MANAGEMENT.md) — one per commit
shipped, under the current month's table (create a new month section if needed). Pull the
exact hash/date/subject from `git log`, note if a migration was included (it shouldn't be, in
a routine deploy), then commit and push that update too.

---

## Rollback

If a deploy goes bad, restore the previous static build and restart:

```bash
cd server
rm -rf public/*
cp -r public_backup_<TS>/* public/
pm2 restart <process-name>
```

For a bad code change (not just static assets), `git revert` the offending commit(s), then
repeat Part B from B3 (rebuild/redeploy).

The database is never part of a rollback for a routine deploy — if a migration genuinely needs
reverting, that's a DB change and goes through the safety rules at the top of this doc,
including a fresh `pg_dump` snapshot before touching anything.

---

## Summary checklist (routine deploy)

- [ ] Diff reviewed — confirmed no schema/migration changes
- [ ] Only intended files staged and committed (no `-A`/`.`)
- [ ] Pushed to the correct branch
- [ ] Client built with correct `VITE_BASE_PATH` (verified in `dist/index.html`)
- [ ] Existing `server/public/` backed up with timestamp before overwrite
- [ ] New build copied into `server/public/`
- [ ] Confirmed which PM2 process actually owns the port before restarting
- [ ] Restarted the correct PM2 process(es)
- [ ] Verified port ownership, served build, and API reachability post-restart
- [ ] Release logged in `CHANGE_MANAGEMENT.md` (one row per commit shipped) and pushed
- [ ] **No `prisma migrate`, no `prisma db seed`, no SQL writes, no Prisma Studio edits — at any point**, unless explicitly double-confirmed per the DB safety rules
