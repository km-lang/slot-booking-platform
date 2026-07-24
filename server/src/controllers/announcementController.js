"use strict";

const { readAnnouncements, readResponses, recordResponse } = require("../lib/announcementsStore");

const VALID_FEEDBACK_RESPONSES = ["rating", "skipped"];

// Newest active announcement (by createdAt) this user hasn't answered yet,
// scoped to their role if the announcement targets specific roles. Only ever
// surfaces one at a time — if several are queued, the rest wait their turn
// until this one's been responded to, so a user never gets stacked with
// prompts.
const getPendingAnnouncement = async (req, res, next) => {
  try {
    const [announcements, responses] = await Promise.all([readAnnouncements(), readResponses()]);

    const answeredIds = new Set(
      responses.filter((r) => r.userId === req.user.sub).map((r) => r.announcementId),
    );

    const candidate = announcements
      .filter((a) => a.active)
      .filter((a) => !a.roles || a.roles.includes(req.user.role))
      .filter((a) => !answeredIds.has(a.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!candidate) return res.json({ announcement: null });

    res.json({
      announcement: {
        id: candidate.id,
        type: candidate.type,
        title: candidate.title,
        message: candidate.message,
      },
    });
  } catch (err) {
    next(err);
  }
};

const respondToAnnouncement = async (req, res, next) => {
  try {
    const announcements = await readAnnouncements();
    const announcement = announcements.find((a) => a.id === req.params.id);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });

    const { response, rating } = req.body;

    if (announcement.type === "feature") {
      if (response !== "acknowledged") {
        return res.status(400).json({ error: "response must be 'acknowledged' for a feature announcement" });
      }
    } else if (announcement.type === "feedback") {
      if (!VALID_FEEDBACK_RESPONSES.includes(response)) {
        return res.status(400).json({ error: "response must be 'rating' or 'skipped' for a feedback prompt" });
      }
      if (response === "rating") {
        const n = Number(rating);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          return res.status(400).json({ error: "rating must be an integer 1-5" });
        }
      }
    }

    await recordResponse({
      announcementId: announcement.id,
      userId:         req.user.sub,
      email:          req.user.email,
      role:           req.user.role,
      response,
      rating:         response === "rating" ? Number(rating) : null,
      respondedAt:    new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPendingAnnouncement, respondToAnnouncement };
