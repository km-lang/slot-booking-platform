"use strict";

const prisma = require("../lib/prisma");

// PATCH /profile
// Name is locked to Google account (set at login, never editable).
// MENTOR only: update firm and domain.
const updateProfile = async (req, res, next) => {
  try {
    const { firm, domain } = req.body;

    const user = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "MENTOR" && (firm !== undefined || domain !== undefined)) {
      const mentorUpdates = {};
      if (firm   && typeof firm   === "string") mentorUpdates.firm   = firm.trim();
      if (domain && typeof domain === "string") mentorUpdates.domain = domain.trim();

      if (Object.keys(mentorUpdates).length > 0) {
        await prisma.mentorProfile.update({
          where: { userId: req.user.sub },
          data:  mentorUpdates,
        });
      }
    }

    const mp = user.role === "MENTOR"
      ? await prisma.mentorProfile.findUnique({
          where:  { userId: req.user.sub },
          select: { firm: true, domain: true, slug: true },
        })
      : null;

    res.json({ name: user.name, email: user.email, role: user.role, ...(mp ?? {}) });
  } catch (err) {
    next(err);
  }
};

// GET /profile — returns current user's profile.
// Students also get their cohort label and assigned Disha mentor name (read-only).
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { name: true, email: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Mentor-specific fields
    if (user.role === "MENTOR") {
      const mp = await prisma.mentorProfile.findUnique({
        where:  { userId: req.user.sub },
        select: { firm: true, domain: true, slug: true },
      });
      return res.json({ ...user, ...(mp ?? {}) });
    }

    // Student-specific: add cohort + assigned Disha mentor (read-only, derived from cohort)
    if (user.role === "STUDENT") {
      const sp = await prisma.studentProfile.findUnique({
        where:  { userId: req.user.sub },
        include: {
          cohort: {
            select: {
              label: true,
              mentorProfiles: {
                take: 1,
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
      });
      const cohort      = sp?.cohort?.label ?? null;
      const dishaMentor = sp?.cohort?.mentorProfiles[0]?.user?.name ?? null;
      return res.json({ ...user, cohort, dishaMentor });
    }

    // AIGs-specific: category (e.g. "COMMITTEE" for Disha) drives the display
    // label on the profile page and account menu.
    if (user.role === "AIGs") {
      const whitelistEntry = await prisma.accessWhitelist.findUnique({
        where:  { email: user.email },
        include: { aig: { select: { category: true } } },
      });
      const aigCategory = whitelistEntry?.aig?.category ?? null;
      return res.json({ ...user, aigCategory });
    }

    res.json({ ...user });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };
