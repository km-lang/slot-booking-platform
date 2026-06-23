"use strict";

const prisma = require("../lib/prisma");

// PATCH /profile
// All roles: update name
// MENTOR only: also update firm, domain
const updateProfile = async (req, res, next) => {
  try {
    const { name, firm, domain } = req.body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    const updates = {};
    if (name) updates.name = name.trim();

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data:  updates,
      select: { id: true, name: true, email: true, role: true },
    });

    // Mentor-specific profile fields
    if (req.user.role === "MENTOR" && (firm !== undefined || domain !== undefined)) {
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

    // Re-fetch mentor fields so the response matches GET /profile shape
    let mentorFields = null;
    if (user.role === "MENTOR") {
      const mp = await prisma.mentorProfile.findUnique({
        where:  { userId: req.user.sub },
        select: { firm: true, domain: true, slug: true },
      });
      mentorFields = mp;
    }

    res.json({ name: user.name, email: user.email, role: user.role, ...(mentorFields ?? {}) });
  } catch (err) {
    next(err);
  }
};

// GET /profile  — returns current user's profile + mentor fields if applicable
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { name: true, email: true, role: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    let mentorFields = null;
    if (user.role === "MENTOR") {
      const mp = await prisma.mentorProfile.findUnique({
        where:  { userId: req.user.sub },
        select: { firm: true, domain: true, slug: true },
      });
      mentorFields = mp;
    }

    res.json({ ...user, ...(mentorFields ?? {}) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };
