"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");

const authRouter  = require("./routes/auth");
const apiRouter   = require("./routes/api");
const { startScheduler } = require("./lib/scheduler");
const prisma = require("./lib/prisma");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api", apiRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
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
