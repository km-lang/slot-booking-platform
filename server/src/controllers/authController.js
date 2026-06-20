"use strict";

// Phase 2 stub — full implementation in Phase 3.
// Flow: verify Google id_token → check AccessWhitelist → upsert User → issue session JWT

const googleSignIn = async (req, res, next) => {
  try {
    // TODO Phase 3:
    // 1. const { idToken } = req.body
    // 2. Verify with google-auth-library OAuth2Client.verifyIdToken()
    // 3. Extract email from payload
    // 4. Look up email in AccessWhitelist — 403 if absent
    // 5. prisma.user.upsert({ where: { email }, create: { email, role, name } })
    // 6. Sign and return our own JWT: jwt.sign({ sub: user.id, role, aigId? }, JWT_SECRET)
    res.status(501).json({ error: "Auth not implemented yet — Phase 3" });
  } catch (err) {
    next(err);
  }
};

module.exports = { googleSignIn };
