"use strict";

// Minimal RFC 5545 iCalendar VEVENT builder. Produces exactly what
// nodemailer's `icalEvent` option needs to render a real "Accept/Decline"
// calendar invite in Gmail/Outlook/Apple Calendar — no external dependency.

// Shared across every controller that builds a calendar event, so it's defined
// once here rather than duplicated per file.
const CALENDAR_ORGANIZER_EMAIL = process.env.SMTP_FROM?.match(/<(.+)>/)?.[1] ?? "noreply@iiml.ac.in";

const fmtICSDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

// Escape order matters: backslash first, or the later escapes would
// double-escape the backslashes they themselves introduce.
const escapeICS = (s) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

// `sequence` must increase across emails referencing the same `uid` (0 on
// create, 1+ on cancel/update) so calendar clients treat it as a revision
// of the same event rather than a new one.
const buildSessionEvent = ({
  uid, sequence = 0, method = "REQUEST", status = "CONFIRMED",
  startTime, endTime, summary, description, location, meetingLink,
  organizerEmail, organizerName, attendees,
}) => {
  // When there's a meeting link, fold it into LOCATION too — some calendar
  // clients (notably mobile Gmail/Calendar) surface LOCATION more prominently
  // than the URL property, so it shouldn't be the only place the link lives.
  const fullLocation = meetingLink ? `${location} — ${meetingLink}` : location;
  const fullDescription = meetingLink ? `${description}\n\nJoin: ${meetingLink}` : description;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parthsaarthi//by Team SynapsE//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:booking-${uid}@parthsaarthi.iiml.ac.in`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${fmtICSDate(new Date())}`,
    `DTSTART:${fmtICSDate(startTime)}`,
    `DTEND:${fmtICSDate(endTime)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(fullDescription)}`,
    `LOCATION:${escapeICS(fullLocation)}`,
    ...(meetingLink ? [`URL:${meetingLink}`] : []),
    `ORGANIZER;CN=${escapeICS(organizerName)}:mailto:${organizerEmail}`,
    ...attendees.map(
      (a) => `ATTENDEE;CN=${escapeICS(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`,
    ),
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
};

// Web fallback alongside the .ics invite — Gmail's mobile app is inconsistent
// about rendering ICS attachments with full Accept/Decline UI, so every
// confirmation/update email gets this one-click link too.
const buildGoogleCalendarLink = ({ summary, description, location, startTime, endTime }) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${fmtICSDate(startTime)}/${fmtICSDate(endTime)}`,
    details: description,
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

module.exports = { buildSessionEvent, buildGoogleCalendarLink, CALENDAR_ORGANIZER_EMAIL };
