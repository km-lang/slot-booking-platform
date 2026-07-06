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

// DEV_EMAIL_OVERRIDE: when set, ALL emails are redirected to this address.
// Useful for local testing so real SMTP traffic goes only to the developer.
const DEV_TO = process.env.DEV_EMAIL_OVERRIDE ?? null;

// icalEvent: { method: "REQUEST" | "CANCEL", content: <ics string> } — passed straight
// through to nodemailer, which renders it as a real calendar invite with native
// Accept/Decline UI in Gmail/Outlook/Apple Calendar (not just a generic attachment).
const send = async ({ to, cc, subject, html, text, icalEvent }) => {
  const effectiveTo = DEV_TO ?? to;
  const effectiveCc = DEV_TO ? undefined : cc;
  const t = getTransport();
  if (!t) {
    // No SMTP configured — log to console
    console.log(`\n[EMAIL] To: ${effectiveTo}${DEV_TO && DEV_TO !== to ? ` (override; original: ${to})` : ""}`);
    if (effectiveCc) console.log(`[EMAIL] Cc: ${effectiveCc}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${text ?? html}`);
    console.log(icalEvent ? `[EMAIL] Calendar invite (${icalEvent.method}) attached\n` : "");
    return;
  }
  try {
    await t.sendMail({ from: FROM, to: effectiveTo, ...(effectiveCc && { cc: effectiveCc }), subject, html, text, ...(icalEvent && { icalEvent }) });
  } catch (err) {
    // A wedged connection (e.g. after a transient SMTP error) can leave this
    // cached transport permanently broken — drop it so the next send rebuilds
    // a fresh one instead of failing forever until the process restarts.
    transport = null;
    throw err;
  }
};

// ── Templates ──────────────────────────────────────────────────────────────────

const wrap = (body) => `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#02120A">
  <div style="background:#064E3B;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#6EE7B7;font-weight:900;font-size:18px;letter-spacing:-0.5px">Parthsaarthi</span>
    <span style="color:#A7F3D0;font-size:12px;margin-left:8px">by Team SynapsE · IIM Lucknow</span>
  </div>
  <div style="background:#F8FAF7;padding:24px;border:1px solid #D1FAE5;border-top:none;border-radius:0 0 12px 12px">
    ${body}
  </div>
</div>`;

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#064E3B;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;margin-right:8px">${label}</a>`;

const secondaryBtn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:transparent;color:#064E3B;font-weight:700;padding:12px 24px;border-radius:8px;border:1.5px solid #064E3B;text-decoration:none;margin-top:16px">${label}</a>`;

// ── Exported email senders ─────────────────────────────────────────────────────

/**
 * Sent to a student immediately after a successful booking.
 */
const sendBookingConfirmation = ({ studentEmail, studentName, mentorName, firm, date, time, venue, focus, meetingLink, icsContent, calendarLink }) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  return send({
    to:      studentEmail,
    subject: `Booking confirmed: ${focusLabel} with ${mentorName} on ${date}`,
    text:    `Hi ${studentName}, your ${focusLabel} session with ${mentorName} (${firm}) is confirmed for ${date} at ${time}, ${venue}.${meetingLink ? ` Join here: ${meetingLink}` : ""} A calendar invite is attached.${calendarLink ? ` Add to Google Calendar: ${calendarLink}` : ""} To cancel, use the app — cancelling is never automatically penalised, but late or repeated cancellations may result in your mentor applying a strike.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Booking Confirmed</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="font-size:15px">${mentorName}</b>
        <span style="font-size:13px;color:#064E3B99;margin-left:6px">${firm}</span><br>
        <span style="font-size:13px;color:#064E3B;margin-top:6px;display:block">${date} · ${time}</span>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      ${meetingLink ? btn(meetingLink, "Join Google Meet") : ""}
      ${calendarLink ? secondaryBtn(calendarLink, "Add to Google Calendar") : ""}
      <p style="font-size:13px;color:#064E3B99;margin:16px 0 0">
        A calendar invite is attached to this email — accept it and your calendar app will remind you 30 minutes before the session.<br>
        Cancelling is never automatically penalised, but late or repeated cancellations may result in your mentor applying a strike.
      </p>
    `),
    ...(icsContent && { icalEvent: { method: "REQUEST", content: icsContent } }),
  });
};

/**
 * Sent to a mentor immediately after a student books one of their slots.
 */
const sendBookingConfirmationToMentor = ({ mentorEmail, mentorName, studentName, pgpId, date, time, venue, focus, meetingLink, icsContent, calendarLink }) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  return send({
    to:      mentorEmail,
    subject: `New booking: ${studentName} on ${date} at ${time}`,
    text:    `Hi ${mentorName}, ${studentName} (PGP-${pgpId}) booked a ${focusLabel} session with you on ${date} at ${time}, ${venue}.${meetingLink ? ` Join here: ${meetingLink}` : ""} A calendar invite is attached.${calendarLink ? ` Add to Google Calendar: ${calendarLink}` : ""}`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">New Booking</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="font-size:15px">${studentName}</b>
        <span style="font-size:13px;color:#064E3B99;margin-left:6px">PGP-${pgpId}</span><br>
        <span style="font-size:13px;color:#064E3B;margin-top:6px;display:block">${date} · ${time}</span>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      ${meetingLink ? btn(meetingLink, "Join Google Meet") : ""}
      ${calendarLink ? secondaryBtn(calendarLink, "Add to Google Calendar") : ""}
      <p style="font-size:13px;color:#064E3B99;margin:16px 0 0">A calendar invite is attached to this email.</p>
    `),
    ...(icsContent && { icalEvent: { method: "REQUEST", content: icsContent } }),
  });
};

/**
 * Single booking confirmation email sent to BOTH student and mentor together (to: field).
 * Replaces the pair of sendBookingConfirmation + sendBookingConfirmationToMentor calls.
 */
const sendBookingConfirmationCombined = ({
  studentEmail, studentName, mentorEmail, mentorName,
  pgpId, firm, date, time, venue, focus, meetingLink, icsContent, calendarLink,
}) => {
  const focusLabel = { overall: "Overall CV Review", workex: "Work Experience", por: "POR / ECA" }[focus] ?? focus;
  const toList     = [studentEmail, mentorEmail].filter(Boolean).join(", ");
  return send({
    to:      toList,
    subject: `Session confirmed: ${studentName} × ${mentorName} · ${date}`,
    text:    `This confirms the ${focusLabel} session between ${studentName} (PGP-${pgpId}) and ${mentorName} (${firm}) on ${date} at ${time}, ${venue}.${meetingLink ? ` Join here: ${meetingLink}` : ""} A calendar invite is attached.${calendarLink ? ` Add to Google Calendar: ${calendarLink}` : ""} Students: cancelling is never automatically penalised, but late or repeated cancellations may result in a mentor-applied strike.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Session Confirmed</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">${focusLabel}</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <b style="font-size:15px">${studentName}</b>
            <span style="font-size:13px;color:#064E3B99;margin-left:6px">PGP-${pgpId}</span>
          </div>
          <div style="text-align:right">
            <b style="font-size:15px">${mentorName}</b>
            <span style="font-size:13px;color:#064E3B99;display:block">${firm}</span>
          </div>
        </div>
        <div style="margin-top:12px;border-top:1px solid #A7F3D0;padding-top:12px">
          <span style="font-size:13px;color:#064E3B;font-weight:600">${date} · ${time}</span><br>
          <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
        </div>
      </div>
      ${meetingLink ? btn(meetingLink, "Join Google Meet") : ""}
      ${calendarLink ? secondaryBtn(calendarLink, "Add to Google Calendar") : ""}
      <p style="font-size:13px;color:#064E3B99;margin:16px 0 0">
        A calendar invite is attached — accept it to add the session to your calendar and get a reminder 30 minutes before it starts.<br>
        Students: cancelling is never automatically penalised, but late or repeated cancellations may result in a mentor-applied strike.
      </p>
    `),
    ...(icsContent && { icalEvent: { method: "REQUEST", content: icsContent } }),
  });
};

/**
 * Sent to a student when they cancel a booking. Cancelling is never itself
 * penalised — the mentor is notified separately and may, at their own
 * discretion, apply a strike afterward (see sendStrikeAppliedToStudent).
 */
const sendCancelConfirmationToStudent = ({ studentEmail, studentName, mentorName, date, time, icsContent }) =>
  send({
    to:      studentEmail,
    subject: `Booking cancelled: ${mentorName} on ${date}`,
    text:    `Hi ${studentName}, your session with ${mentorName} on ${date} at ${time} has been cancelled. Your mentor has been notified.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Booking Cancelled</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Your session has been removed</p>
      <div style="background:#FEF9F0;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${mentorName}</b><br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span>
      </div>
      <p style="font-size:14px;color:#064E3B">Your mentor has been notified. Repeated or last-minute cancellations may lead to a strike at your mentor's discretion.</p>
      <p style="font-size:13px;color:#064E3B99;margin-top:8px">You can book a new slot from the app at any time. The calendar event has been cancelled.</p>
    `),
    ...(icsContent && { icalEvent: { method: "CANCEL", content: icsContent } }),
  });

/**
 * Sent to a student when a mentor reassigns their confirmed booking to a
 * different student — the slot itself isn't cancelled, just no longer theirs.
 * No penalty implied; distinct copy from sendCancelConfirmationToStudent so it
 * doesn't read as "you cancelled this."
 */
const sendBookingReassignedToStudent = ({ studentEmail, studentName, mentorName, date, time, icsContent }) =>
  send({
    to:      studentEmail,
    subject: `Your session with ${mentorName} on ${date} is no longer available`,
    text:    `Hi ${studentName}, your mentor ${mentorName} has moved the ${date} at ${time} session to another student. This wasn't something you did — reach out to your mentor if you'd like to rebook.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Session No Longer Available</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Reassigned by your mentor</p>
      <div style="background:#FEF9F0;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${mentorName}</b><br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span>
      </div>
      <p style="font-size:14px;color:#064E3B">Your mentor has moved this session to another student. This is not something you did, and no strike or penalty applies.</p>
      <p style="font-size:13px;color:#064E3B99;margin-top:8px">You can book a new slot from the app at any time. The calendar event has been cancelled.</p>
    `),
    ...(icsContent && { icalEvent: { method: "CANCEL", content: icsContent } }),
  });

/**
 * Sent to a mentor whenever a student cancels a booking — keeps the mentor's
 * calendar in sync, and is also their cue to review the cancellation and
 * optionally apply a strike from the dashboard.
 */
const sendBookingCancelledToMentor = ({ mentorEmail, mentorName, studentName, pgpId, date, time, icsContent }) =>
  send({
    to:      mentorEmail,
    subject: `Booking cancelled: ${studentName} on ${date} at ${time}`,
    text:    `Hi ${mentorName}, ${studentName} (PGP-${pgpId}) cancelled their ${time} session on ${date}. It has been removed from your calendar.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Booking Cancelled</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">This slot is now free</p>
      <div style="background:#FEF9F0;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b>${studentName}</b>
        <span style="font-size:13px;color:#064E3B99;margin-left:6px">PGP-${pgpId}</span><br>
        <span style="font-size:13px;color:#064E3B99">${date} · ${time}</span>
      </div>
      <p style="font-size:13px;color:#064E3B99;margin:0">The calendar event has been cancelled.</p>
    `),
    ...(icsContent && { icalEvent: { method: "CANCEL", content: icsContent } }),
  });

/**
 * Sent to both student and mentor when a mentor reschedules an already-booked
 * session to a new time. No penalty either direction — this is a time change,
 * not a cancellation.
 */
const sendRescheduleNotification = ({ to, recipientName, otherPartyName, oldDate, oldTime, newDate, newTime, venue, meetingLink, icsContent, calendarLink }) =>
  send({
    to,
    subject: `Session rescheduled: now ${newDate} at ${newTime}`,
    text:    `Hi ${recipientName}, your session with ${otherPartyName} has been moved from ${oldDate} ${oldTime} to ${newDate} ${newTime}, ${venue}.${meetingLink ? ` Join here: ${meetingLink}` : ""} Your calendar invite has been updated.${calendarLink ? ` Add to Google Calendar: ${calendarLink}` : ""}`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Session Rescheduled</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">with ${otherPartyName}</p>
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin-bottom:12px">
        <span style="font-size:12px;color:#92400E;text-decoration:line-through">${oldDate} · ${oldTime}</span>
      </div>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="font-size:15px;color:#064E3B">${newDate} · ${newTime}</b><br>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      ${meetingLink ? btn(meetingLink, "Join Google Meet") : ""}
      ${calendarLink ? secondaryBtn(calendarLink, "Add to Google Calendar") : ""}
      <p style="font-size:13px;color:#064E3B99;margin:16px 0 0">Your calendar invite has been updated automatically — no action needed.</p>
    `),
    ...(icsContent && { icalEvent: { method: "REQUEST", content: icsContent } }),
  });

/**
 * Sent to every waitlisted student once, when a slot they wanted frees up.
 * Notification only — booking still goes through the normal flow, first to
 * actually submit wins (no auto-booking on anyone's behalf).
 */
const sendWaitlistSlotAvailable = ({ studentEmail, studentName, mentorName, firm, date, time, venue }) =>
  send({
    to:      studentEmail,
    subject: `A slot with ${mentorName} just opened up`,
    text:    `Hi ${studentName}, a slot with ${mentorName} (${firm}) on ${date} at ${time}, ${venue} just became available — you were on the waitlist. Open the app now to book it before someone else does.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">A Slot Just Opened Up 🎉</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">You were waitlisted for this session</p>
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="font-size:15px">${mentorName}</b>
        <span style="font-size:13px;color:#064E3B99;margin-left:6px">${firm}</span><br>
        <span style="font-size:13px;color:#064E3B;margin-top:6px;display:block">${date} · ${time}</span>
        <span style="font-size:13px;color:#064E3B99">📍 ${venue}</span>
      </div>
      <p style="font-size:13px;color:#064E3B99;margin:0"><b>Open the app and book it now</b> — it's first-come, first-served, so other waitlisted students got this same email.</p>
    `),
  });

/**
 * Sent to every student with a confirmed booking on a slot the mentor has just
 * marked as running late — one email covering the whole slot (all students in
 * To:, mentor in Cc:) rather than a separate email per student.
 */
const sendDelayNotification = ({ students, mentorName, mentorEmail, date, time, venue, delayMinutes }) => {
  const names = students.map((s) => s.name).join(", ");
  return send({
    to:      students.map((s) => s.email).join(", "),
    cc:      mentorEmail || undefined,
    subject: `Your session with ${mentorName} is running ${delayMinutes} min late`,
    text:    `Hi ${names}, your ${time} session on ${date} with ${mentorName} at ${venue} is running approximately ${delayMinutes} minutes late. Please wait — the session is still on.`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Running a bit late ⏱</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">Session update from ${mentorName}</p>
      <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="color:#92400E">Running ~${delayMinutes} minutes late</b><br>
        <span style="color:#92400E;font-size:13px">${date} · ${time} · ${venue}</span>
      </div>
      <p style="font-size:14px;color:#064E3B">Hi ${names}, your mentor will be with you shortly. The session is still happening — please wait at the venue.</p>
    `),
  });
};

/**
 * Sent to a student when their mentor manually applies a strike to a
 * cancellation they made — the only path that ever produces a strike from a
 * cancellation now, so this is the student's sole notice it happened.
 */
const sendStrikeAppliedToStudent = ({ studentEmail, studentName, mentorName, date, time, banApplied, banDurationHours }) => {
  const banNote = banApplied
    ? banDurationHours
      ? ` This also triggered a booking ban for approximately ${banDurationHours} hour${banDurationHours === 1 ? "" : "s"}.`
      : " This also triggered a booking ban."
    : "";

  return send({
    to:      studentEmail,
    subject: `A strike was applied to your account`,
    text:    `Hi ${studentName}, ${mentorName} applied a strike to your record for the ${date} at ${time} session you cancelled.${banNote}`,
    html:    wrap(`
      <h2 style="margin:0 0 8px;font-size:20px">Strike Applied</h2>
      <p style="color:#064E3B99;font-size:13px;margin:0 0 20px">From your cancelled session with ${mentorName}</p>
      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <b style="color:#991B1B">${mentorName}</b> applied a strike for the session you cancelled on ${date} at ${time}.${banNote ? `<br><span style="font-size:13px;color:#991B1B">${banNote.trim()}</span>` : ""}
      </div>
      <p style="font-size:13px;color:#064E3B99;margin:0">Reach out to your mentor directly if you'd like to discuss this.</p>
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
  sendBookingConfirmationToMentor,
  sendBookingConfirmationCombined,
  sendCancelConfirmationToStudent,
  sendBookingReassignedToStudent,
  sendBookingCancelledToMentor,
  sendRescheduleNotification,
  sendWaitlistSlotAvailable,
  sendDelayNotification,
  sendStrikeAppliedToStudent,
  sendAigDigest,
};
