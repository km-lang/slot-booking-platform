"use strict";

const nodemailer = require("nodemailer");

// ── Transport ──────────────────────────────────────────────────────────────────
// When SMTP_HOST is set, use real SMTP (production).
// Otherwise, print email to console so dev works with zero config.

let transport = null;

const getTransport = () => {
  if (transport) return transport;
  if (process.env.SMTP_HOST) {
    transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transport;
};

const FROM = process.env.SMTP_FROM ?? "Parthsaarthi <noreply@iiml.ac.in>";

const send = async ({ to, subject, html, text }) => {
  const t = getTransport();
  if (!t) {
    // Dev mode — log to console instead of sending
    console.log(`\n[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${text ?? html}\n`);
    return;
  }
  await t.sendMail({ from: FROM, to, subject, html, text });
};

// ── Templates ──────────────────────────────────────────────────────────────────

const wrap = (body) => `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#02120A">
  <div style="background:#064E3B;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#6EE7B7;font-weight:900;font-size:18px;letter-spacing:-0.5px">Parthsaarthi</span>
    <span style="color:#A7F3D0;font-size:12px;margin-left:8px">by Shukracharya · IIM Lucknow</span>
  </div>
  <div style="background:#F8FAF7;padding:24px;border:1px solid #D1FAE5;border-top:none;border-radius:0 0 12px 12px">
    ${body}
  </div>
</div>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#064E3B;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">${label}</a>`;

// ── Exported email senders ─────────────────────────────────────────────────────

/**
 * Sent to a student immediately after a successful booking.
 */
const sendBookingConfirmation = ({ studentEmail, studentName, mentorName, firm, date, time, venue, focus }) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  return send({
    to:      studentEmail,
    subject: `Booking confirmed: ${focusLabel} with ${mentorName} on ${date}`,
    text:    `Hi ${studentName}, your ${focusLabel} session with ${mentorName} (${firm}) is confirmed for ${date} at ${time}, ${venue}. To cancel, use the app — cancellations less than 60 minutes before the slot incur a penalty.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Booking Confirmed</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="font-size:15px">${mentorName}</b>
        <span style="font-size:13px;color:#064E3B99;margin-left:6px">${firm}</span><br>
        <span style="font-size:13px;color:#064E3B;margin-top:6px;display:block">${date} · ${time}</span>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      <p style="font-size:13px;color:#064E3B99;margin:0">
        You will receive a reminder 30 minutes before the session.<br>
        If you need to cancel, do so <b>at least 60 minutes in advance</b> to avoid a penalty.
      </p>
    `),
  });
};

/**
 * Sent to a student when they cancel a booking (always, regardless of penalty).
 */
const sendCancelConfirmationToStudent = ({ studentEmail, studentName, mentorName, date, time, penalty }) => {
  const penaltyNote = penalty === "STRIKE"
    ? "⚠️ A <b>strike</b> has been added to your account for last-minute cancellation."
    : penalty === "WARNING"
    ? "⚠️ A <b>warning</b> has been added to your account for late cancellation."
    : "No penalty was applied.";

  return send({
    to:      studentEmail,
    subject: `Booking cancelled: ${mentorName} on ${date}`,
    text:    `Hi ${studentName}, your session with ${mentorName} on ${date} at ${time} has been cancelled. ${penalty !== "NONE" ? `Penalty applied: ${penalty}.` : "No penalty applied."}`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Booking Cancelled</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Your session has been removed</p>
      <div style="background:#FEF9F0;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${mentorName}</b><br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span>
      </div>
      <p style="font-size:14px;color:#064E3B">${penaltyNote}</p>
      <p style="font-size:13px;color:#064E3B99;margin-top:8px">You can book a new slot from the app at any time.</p>
    `),
  });
};

/**
 * Sent to a student when their mentor marks a slot as running late.
 */
const sendDelayNotification = ({ studentEmail, studentName, mentorName, date, time, venue, delayMinutes }) =>
  send({
    to:      studentEmail,
    subject: `Your session with ${mentorName} is running ${delayMinutes} min late`,
    text:    `Hi ${studentName}, your ${time} session on ${date} with ${mentorName} at ${venue} is running approximately ${delayMinutes} minutes late. Please wait — the session is still on.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Running a bit late ⏱</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Session update from ${mentorName}</p>
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="color:#92400E">Running ~${delayMinutes} minutes late</b><br>
        <span style="color:#92400E;font-size:13px">${date} · ${time} · ${venue}</span>
      </div>
      <p style="font-size:14px;color:#064E3B">Hi ${studentName}, your mentor will be with you shortly. The session is still happening — please wait at the venue.</p>
    `),
  });

/**
 * Sent to a mentor when a student cancels less than 60 minutes before the slot.
 */
const sendLateCancelToMentor = ({ mentorEmail, mentorName, studentName, pgpId, date, time, penalty }) => {
  const penaltyNote = penalty === "STRIKE"
    ? "This was a <b>last-minute cancellation</b> (less than 30 minutes before start). A strike has been issued."
    : "This was a late cancellation (30–59 minutes before start). A warning has been issued.";

  return send({
    to:      mentorEmail,
    subject: `Slot cancellation: ${studentName} cancelled their ${time} session`,
    text:    `Hi ${mentorName}, ${studentName} (PGP-${pgpId}) has cancelled their ${time} slot on ${date}. ${penalty} issued.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Slot Cancelled</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Your ${date} · ${time} session is now free</p>
      <p style="font-size:14px;color:#064E3B"><b>${studentName}</b> (PGP-${pgpId}) has cancelled their booking. ${penaltyNote}</p>
    `),
  });
};

/**
 * Sent to a student 30 minutes before their booked slot.
 */
const sendStudentReminder = ({ studentEmail, studentName, mentorName, firm, date, time, venue, focus }) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  return send({
    to:      studentEmail,
    subject: `Reminder: Session with ${mentorName} in 30 minutes`,
    text:    `Hi ${studentName}, just a reminder that your ${focusLabel} session with ${mentorName} (${firm}) is at ${time} on ${date} at ${venue}.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Session in 30 minutes 🗓</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${mentorName}</b> · ${firm}<br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span><br>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      <p style="font-size:13px;color:#064E3B99">Please arrive on time. If you need to cancel, do so now to avoid a penalty.</p>
    `),
  });
};

/**
 * Sent to a mentor 30 minutes before a booked session.
 */
const sendMentorReminder = ({ mentorEmail, mentorName, studentName, pgpId, date, time, venue, focus }) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  return send({
    to:      mentorEmail,
    subject: `Reminder: Session with ${studentName} in 30 minutes`,
    text:    `Hi ${mentorName}, you have a ${focusLabel} session with ${studentName} (PGP-${pgpId}) at ${time} on ${date} at ${venue}.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Session in 30 minutes 🗓</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${studentName}</b> · PGP-${pgpId}<br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span><br>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
    `),
  });
};

/**
 * Sent to an AIG admin at 8 AM daily if at-risk students exist.
 */
const sendAigDigest = ({ adminEmail, adminName, aigName, atRiskCount, deadline, students }) => {
  const rows = students.slice(0, 15).map(
    (s) => `<tr><td style="padding:6px 0;font-size:13px">${s.name}</td><td style="padding:6px 0;font-size:12px;color:#064E3B99">${s.cohortLabel}</td><td style="padding:6px 0;font-size:12px;color:#DC2626">${s.reason}</td></tr>`
  ).join("");

  return send({
    to:      adminEmail,
    subject: `Daily digest — ${atRiskCount} student${atRiskCount !== 1 ? "s" : ""} need intervention · ${aigName}`,
    text:    `Hi ${adminName}, ${atRiskCount} students in ${aigName} have not completed a review session. Deadline: ${deadline ?? "not set"}.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Daily Digest — ${aigName}</h2>
      <p style="font-size:14px;color:#064E3B;margin-bottom:16px">
        <b>${atRiskCount}</b> student${atRiskCount !== 1 ? "s" : ""} need${atRiskCount === 1 ? "s" : ""} a review session.
        ${deadline ? `CV Freeze deadline: <b>${deadline}</b>.` : ""}
      </p>
      ${students.length > 0 ? `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #D1FAE5">
            <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#064E3B99">Student</th>
            <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#064E3B99">Cohort</th>
            <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#064E3B99">Reason</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${students.length > 15 ? `<p style="font-size:12px;color:#064E3B99;margin-top:8px">…and ${students.length - 15} more</p>` : ""}
      ` : ""}
    `),
  });
};

module.exports = {
  sendBookingConfirmation,
  sendCancelConfirmationToStudent,
  sendDelayNotification,
  sendLateCancelToMentor,
  sendStudentReminder,
  sendMentorReminder,
  sendAigDigest,
};
