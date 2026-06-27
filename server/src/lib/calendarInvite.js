"use strict";

// Minimal RFC 5545 iCalendar VEVENT builder. Produces exactly what
// nodemailer's `icalEvent` option needs to render a real "Accept/Decline"
// calendar invite in Gmail/Outlook/Apple Calendar — no external dependency.

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
  startTime, endTime, summary, description, location,
  organizerEmail, organizerName, attendees,
}) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parthsaarthi//SIP Mentor Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:booking-${uid}@parthsaarthi.iiml.ac.in`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${fmtICSDate(new Date())}`,
    `DTSTART:${fmtICSDate(startTime)}`,
    `DTEND:${fmtICSDate(endTime)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
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

module.exports = { buildSessionEvent };
