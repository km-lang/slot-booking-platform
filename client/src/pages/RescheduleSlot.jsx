import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useRescheduleSlot } from "../hooks/useApi";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { VENUE_OPTIONS, isOnlineVenue } from "../lib/venues";

const toLocalHHMM = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const toLocalYYYYMMDD = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Mentor-initiated time and/or venue change for an already-booked session —
// same booking, same student, no penalty either direction. Student (and mentor)
// get an updated calendar invite automatically. Session data comes via router
// state (set by the calendar-icon trigger in MentorDashboard) rather than a
// fetch-by-id endpoint, since the dashboard query already has everything this
// page needs.
export default function RescheduleSlot() {
  const navigate = useNavigate();
  const { slotId } = useParams();
  const location = useLocation();
  const session = location.state?.session;

  const [startDate, setStartDate] = useState(session ? toLocalYYYYMMDD(session.startTime) : "");
  const [start, setStart]         = useState(session ? toLocalHHMM(session.startTime) : "");
  const [endDate, setEndDate]     = useState(session ? toLocalYYYYMMDD(session.endTime) : "");
  const [end, setEnd]             = useState(session ? toLocalHHMM(session.endTime) : "");
  // Falls back to the plain venue list if the session was created with a value
  // that's since been retired from VENUE_OPTIONS, so the <select> always has a
  // matching option instead of silently showing the first one.
  const [venue, setVenue] = useState(session?.venue ?? VENUE_OPTIONS[0]);
  const [meetingLink, setMeetingLink] = useState(session?.meetingLink ?? "");
  const reschedule = useRescheduleSlot();
  const venueOptions = session?.venue && !VENUE_OPTIONS.includes(session.venue)
    ? [session.venue, ...VENUE_OPTIONS]
    : VENUE_OPTIONS;

  // Start/end each carry their own day, so a reschedule that spans midnight
  // (e.g. 11:30 PM → 12:00 AM) is just two datetimes with the end one a day
  // later, not an ambiguous same-day wraparound.
  const isRangeValid =
    startDate && start && endDate && end &&
    new Date(`${endDate}T${end}:00`).getTime() > new Date(`${startDate}T${start}:00`).getTime();

  // No router state means a hard refresh / direct deep-link with nothing to show —
  // bounce back to the dashboard instead of crashing on undefined session fields.
  useEffect(() => {
    if (!session) navigate("/mentor", { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  const venueIsOnline = isOnlineVenue(venue);
  // GD/CASE sessions carry a participants[] roster instead of a single student —
  // name this session by its one participant if there's just one (CV/CV-HR,
  // always true there), otherwise by the group size.
  const sessionSubject = session.participants?.length === 1
    ? session.participants[0].name
    : session.participants
    ? `${session.participants.length} participants`
    : session.student?.name;

  const handleSubmit = () => {
    if (!isRangeValid) return;
    const startDateTime = new Date(`${startDate}T${start}:00`).toISOString();
    const endDateTime   = new Date(`${endDate}T${end}:00`).toISOString();
    reschedule.mutate(
      {
        slotId,
        startTime: startDateTime,
        endTime: endDateTime,
        venue,
        meetingLink: venueIsOnline ? meetingLink.trim() : "",
      },
      { onSuccess: () => navigate("/mentor") },
    );
  };

  return (
    <AppShell
      maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl"
      header={
        <PageHeader
          title="Reschedule Session"
          subtitle={<>with <span className="font-bold text-emerald-800">{sessionSubject}</span></>}
          subtitleCase="normal"
          onBack={() => navigate("/mentor")}
        />
      }
    >
        <main className="flex-1 px-4 py-6 pb-safe-6">
          <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">Currently: {session.date} · {session.time} · {session.venue}</p>

          <div className="space-y-3 mb-5">
            <div>
              <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New Start</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                </div>
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                    className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New End</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                </div>
                <div className="min-w-0">
                  <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                    className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                </div>
              </div>
              {endDate !== startDate && (
                <p className="text-[10px] font-bold text-emerald-700/50 mt-1.5">
                  Spans past midnight — ends the next day.
                </p>
              )}
            </div>
            {startDate && start && endDate && end && !isRangeValid && (
              <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                End must be after start — if this crosses midnight, set the End day to the next date.
              </p>
            )}

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Venue</label>
              <select value={venue} onChange={(e) => setVenue(e.target.value)}
                className="w-full bg-white border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none appearance-none">
                {venueOptions.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>

            {venueIsOnline && (
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  Google Meet Link <span className="text-emerald-700/40 font-semibold normal-case">(optional — can add later)</span>
                </label>
                <input
                  type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
                  className="w-full bg-white border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
            )}
          </div>

          {reschedule.error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {reschedule.error.message}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={reschedule.isPending || !isRangeValid}
            loading={reschedule.isPending}
            loadingText="Rescheduling…"
            className="w-full py-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
          >
            Save Changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/mentor")}
            disabled={reschedule.isPending}
            className="w-full mt-2"
          >
            Cancel
          </Button>
          <p className="text-[10px] font-semibold text-emerald-700/40 text-center mt-3">
            No penalty applies. {sessionSubject} will get{session.participants?.length > 1 ? "" : "s"} an updated calendar invite.
          </p>
        </main>
    </AppShell>
  );
}
