require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

const authRouter  = require("./routes/auth");
const apiRouter   = require("./routes/api");
const { startScheduler } = require("./lib/scheduler");
const prisma = require("./lib/prisma");

// FATAL: AUTH_MODE=dev skips Google credential verification entirely (email-only
// login, whitelist still enforced but with zero proof of identity). Refuse to boot
// if it's ever left set alongside NODE_ENV=production.
if (process.env.AUTH_MODE === "dev") {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "FATAL: AUTH_MODE=dev with NODE_ENV=production — refusing to start. " +
      "This would let anyone log in as any whitelisted email with no credential check. " +
      "Unset AUTH_MODE before deploying.",
    );
    process.exit(1);
  }
  console.warn(
    "\n*** WARNING: AUTH_MODE=dev is ACTIVE — Google sign-in is bypassed " +
    "(email-only login, no credential verification). This must NEVER be set in production. ***\n",
  );
}

const app = express();
const PORT = process.env.PORT || 4000;
// Public path this app is mounted under behind the Apache reverse proxy
// (e.g. "/parthsaarthi"). Empty string when served from the domain root.
const BASE_PATH = process.env.BASE_PATH || "";

// Trust the Apache reverse proxy (one hop) so req.ip / X-Forwarded-For resolve to the
// real client IP — without this, IP-keyed rate limiting would bucket every user
// together under the proxy's own address.
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Google Identity Services needs to load its script and open its sign-in iframe
      scriptSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://accounts.google.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(`${BASE_PATH}/api/auth`, authRouter);
app.use(`${BASE_PATH}/api`, apiRouter);

// ── Health check (only when mounted under a subpath — otherwise "/" serves the SPA) ──
if (BASE_PATH) {
  app.get("/", (_req, res) => {
    res.send(`Parthsaarthi Backend Service is Running. Access UI at ${BASE_PATH}`);
  });
}

// ── Serve built client ───────────────────────────────────────────────────────
const clientDist = path.join(__dirname, "../public");
app.use(BASE_PATH, express.static(clientDist));
app.get(/.*/, (req, res, next) => {
  if (!req.path.startsWith(BASE_PATH) || req.path.startsWith(`${BASE_PATH}/api`)) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Centralized error handler ─────────────────────────────────────────────────
// Only echo err.message for genuine 4xx responses (e.g. malformed JSON from the body
// parser) — those don't leak anything sensitive. Unexpected failures (Prisma errors,
// bugs, anything without a deliberate status) always get a generic 500 message; full
// details are still logged server-side above for diagnosis.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status  = err.status || err.statusCode || 500;
  const message = status < 500 ? (err.message || "Bad request") : "Internal server error";
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
  console.log(`Parthsaarthi server running on port ${PORT}`);
  startScheduler();
});

// Graceful shutdown — let in-flight requests finish before closing the DB
process.on("SIGTERM", () => {
  server.close(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
});
