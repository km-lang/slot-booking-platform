# Deployment Runbook — Parthsaarthi (Application Only)

This document describes the **application deployment** process actually used on the
production host (Windows Server, PM2, Apache reverse proxy at `/parthsaarthi`). It
reflects the exact steps followed for the 2026-07-02 deploy.

Application created by Hrishikesh.

> **Scope of this document: application code only.**
> Database changes are covered separately in the "Database Safety Rules" section
> below, and are **out of scope for a routine deploy**.

---

## ⚠️ DATABASE SAFETY RULES — READ FIRST

**Never change production DB data or schema during an application deployment.**
Not as a side effect, not "just this once," not even a read that you're not sure is
read-only. This includes, but is not limited to:

- `npx prisma migrate dev` / `npx prisma migrate deploy`
- `npx prisma db seed` / running `server/prisma/seed.js`
- `npx prisma db push`
- Any `UPDATE`, `DELETE`, `INSERT`, `ALTER`, `DROP`, `TRUNCATE` SQL statement
- Editing rows via Prisma Studio (`npx prisma studio`)
- Any script or one-off Node snippet that writes to the DB

A normal "push changes and redeploy" request means: **ship new application code and
restart the process.** It does **not** imply touching the database, even if the code
change happens to touch a file that lives under `server/prisma/` (e.g. `seed.js`).
Committing/pushing such a file to git is fine — **running** it against the DB is not.

### If a task genuinely requires a DB change

1. Stop. Do not run anything against the database yet.
2. Ask the user for permission **explicitly**, stating in plain words that
   **"this will change DB data."**
3. Wait for an explicit yes.
4. Ask a **second time**, again explicitly stating **"this will change DB data,"**
   confirming exactly what will change (which table/rows, migration name, etc.).
5. Only after two separate explicit confirmations, proceed — and even then, do
   **Step 0** below first.

**Step 0 — always snapshot before any DB change:**

```bash
# Timestamp the snapshot so it's traceable
TS=$(date +%Y%m%d-%H%M%S)

# Dump the production database (adjust connection details to match server/.env DATABASE_URL)
pg_dump "postgresql://postgres:<password>@localhost:5432/parthsaarthi" \
  --format=custom \
  --file="db_backups/parthsaarthi_${TS}.dump"

# Commit and push the snapshot to GitHub before making any change
git add "db_backups/parthsaarthi_${TS}.dump"
git commit -m "chore: DB snapshot before <describe the change> (${TS})"
git push origin <branch>
```

Only once the snapshot is pushed and confirmed should the actual DB change be made,
and only after both explicit confirmations described above.

---

## Application Deployment Steps (routine — no DB involved)

These are the steps actually followed for the code-only deploy. Nothing here touches
the database.

### 1. Confirm what's changing

```bash
git status
git diff --stat
```

Review the diff. Confirm none of the changes require a schema/migration change
(`server/prisma/schema.prisma` untouched, no new file in `server/prisma/migrations/`).
If they do, **stop** — that's a DB change, follow the Database Safety Rules above
instead of this routine flow.

### 2. Stage, commit, push application code

Stage only the files that are actually part of the change — avoid `git add -A` /
`git add .` so unrelated or sensitive files don't get swept in.

```bash
git add <file1> <file2> ...
git commit -m "descriptive message"
git push origin <branch>
```

If a file under `server/prisma/` (like `seed.js`) is part of the change, it is safe
to commit/push as **source code** — just never execute it against production.

### 3. Build the client

The production base path is `/parthsaarthi/` (served behind an Apache reverse proxy
at that path — check `server/.env`'s `BASE_PATH` to confirm before building).

**On Windows with Git Bash**, MSYS path-conversion mangles a leading-slash env var
like `/parthsaarthi/` into a Windows path. Disable it for the build:

```bash
cd client
rm -rf dist
MSYS_NO_PATHCONV=1 VITE_BASE_PATH=/parthsaarthi/ npm run build
```

Verify the build actually baked in the right base path before deploying it:

```bash
grep -o '/parthsaarthi/assets/[^"]*' dist/index.html
```

If this shows anything other than clean `/parthsaarthi/assets/...` paths (e.g. a
Windows path fragment), the base path env var didn't take — rebuild before
proceeding.

### 4. Back up the currently-live build

Never overwrite `server/public/` without a rollback copy first:

```bash
cd ../server
TS=$(date +%Y%m%d-%H%M%S)
cp -r public "public_backup_$TS"
```

These timestamped backup folders are local rollback safety nets — they are **not**
committed to git (the same as `server/public/` itself, which is gitignored).

### 5. Deploy the new build

```bash
rm -rf public/*
cp -r ../client/dist/* public/
ls public/
```

### 6. Identify which PM2 process actually owns the port

Before restarting anything, confirm which process is actually bound to the app port
— on this host there have historically been duplicate/stale PM2 entries pointing at
the same script. Restarting the wrong one, or missing the live one, means the deploy
silently doesn't take effect.

```bash
pm2 list
netstat -ano | grep ":4000"   # match the PID in the LISTENING line back to pm2 list
```

### 7. Restart the app

```bash
pm2 restart <process-name(s)>
```

If duplicate/stale PM2 processes exist pointing at the same script, don't unilaterally
delete or reconfigure them — flag it to the user and ask which one(s) to act on.

### 8. Verify

```bash
# Confirm the live process now holds the port
netstat -ano | grep ":4000"

# Confirm the new build is being served
curl -s http://localhost:4000/parthsaarthi/ | grep -o '/parthsaarthi/assets/[^"]*'

# Confirm the API is reachable (401 without auth is expected/healthy)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/parthsaarthi/api/aigs

# Check logs for startup errors
pm2 logs <process-name> --lines 15 --nostream
```

---

## Summary Checklist

- [ ] Diff reviewed — confirmed no schema/migration changes
- [ ] Only intended files staged and committed (no `-A`/`.`)
- [ ] Pushed to the correct branch
- [ ] Client built with correct `VITE_BASE_PATH` (verified in `dist/index.html`)
- [ ] Existing `server/public/` backed up with timestamp before overwrite
- [ ] New build copied into `server/public/`
- [ ] Confirmed which PM2 process actually owns the port before restarting
- [ ] Restarted the correct PM2 process(es)
- [ ] Verified port ownership, served build, and API reachability post-restart
- [ ] **No `prisma migrate`, no `prisma db seed`, no SQL writes, no Prisma Studio edits — at any point**
