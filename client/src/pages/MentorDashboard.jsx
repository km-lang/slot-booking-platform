import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Plus, Users, CheckCircle, XCircle,
  ChevronRight, Trash2, AlertTriangle, Calendar,
  Clock, Mail, ChevronDown, Link as LinkIcon, Pencil, X,
  Send, UserPlus, Search,
} from "lucide-react";
import {
  useMentorDashboard, useMarkAttendance, useCreateSlots,
  useDeleteSlot, useSetSlotDelay, useSetSlotMeetingLink,
  useRescheduleSlot, useBulkDeleteSlots, useBulkSetMeetingLink,
  useBulkPublishSlots, useAllocateSlot, useAllocateStudentSearch,
} from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
};

const DELAY_PRESETS = [5, 10, 15, 20, 30];

// ── Running Late Sheet ────────────────────────────────────────────────────────
function RunningLateSheet({ session, onClose }) {
  const [delayMins, setDelayMins] = useState(10);
  const [custom, setCustom]       = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const setDelay                  = useSetSlotDelay();

  const effectiveDelay = useCustom ? Number(custom) : delayMins;

  const handleSubmit = () => {
    if (!effectiveDelay || effectiveDelay < 1) return;
    setDelay.mutate(
      { slotId: session.id, delayMinutes: effectiveDelay },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl z-50 p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.12)]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-black text-emerald-950 mb-0.5">Running Late?</h3>
        <p className="text-xs font-semibold text-emerald-700/60 mb-1">
          Session with <span className="text-emerald-800 font-bold">{session.student.name}</span>
        </p>
        <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">{session.date} · {session.time}</p>

        <p className="text-xs font-bold text-emerald-800/60 uppercase tracking-widest mb-3">
          How many minutes late?
        </p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {DELAY_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setUseCustom(false); setDelayMins(m); }}
              className={`py-2.5 rounded-xl text-sm font-bold border transition-colors
                ${!useCustom && delayMins === m
                  ? "bg-amber-100 border-amber-400 text-amber-800"
                  : "bg-[#F5F7FA] border-emerald-900/10 text-emerald-800 hover:bg-amber-50"}`}
            >
              {m}m
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="number"
            min="1"
            max="120"
            placeholder="Custom mins…"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setUseCustom(true); }}
            onFocus={() => setUseCustom(true)}
            className={`flex-1 bg-[#F5F7FA] border rounded-xl px-4 py-2.5 text-sm font-bold outline-none
              ${useCustom ? "border-amber-400" : "border-emerald-900/10"}`}
          />
          <span className="text-xs font-bold text-emerald-700/60">minutes</span>
        </div>

        {setDelay.error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {setDelay.error.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={setDelay.isPending || !effectiveDelay || effectiveDelay < 1}
          className="w-full bg-amber-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {setDelay.isPending
            ? "Updating…"
            : `Notify — Running ${effectiveDelay || "?"}m Late`}
        </button>
      </div>
    </>
  );
}

// ── Reschedule Sheet ─────────────────────────────────────────────────────────────
// Mentor-initiated time shift of an already-booked session — same booking, same
// student, no penalty either direction. Student (and mentor) get an updated
// calendar invite automatically.
const toLocalHHMM = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const toLocalYYYYMMDD = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function RescheduleSheet({ session, onClose }) {
  const [date, setDate] = useState(toLocalYYYYMMDD(session.startTime));
  const [start, setStart] = useState(toLocalHHMM(session.startTime));
  const [end, setEnd] = useState(toLocalHHMM(session.endTime));
  const reschedule = useRescheduleSlot();

  const handleSubmit = () => {
    if (!date || !start || !end) return;
    const startDateTime = new Date(`${date}T${start}:00`).toISOString();
    const endDateTime   = new Date(`${date}T${end}:00`).toISOString();
    reschedule.mutate(
      { slotId: session.id, startTime: startDateTime, endTime: endDateTime },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl z-50 p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.12)]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-black text-emerald-950 mb-0.5">Reschedule Session</h3>
        <p className="text-xs font-semibold text-emerald-700/60 mb-1">
          with <span className="text-emerald-800 font-bold">{session.student.name}</span>
        </p>
        <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">Currently: {session.date} · {session.time}</p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New Start</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New End</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none" />
            </div>
          </div>
        </div>

        {reschedule.error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {reschedule.error.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={reschedule.isPending || !date || !start || !end}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {reschedule.isPending ? "Rescheduling…" : "Confirm New Time"}
        </button>
        <p className="text-[10px] font-semibold text-emerald-700/40 text-center mt-3">
          No penalty applies. {session.student.name} will get an updated calendar invite.
        </p>
      </div>
    </>
  );
}

// ── Allocate Sheet ───────────────────────────────────────────────────────────────
// Lets a mentor directly hand a specific open slot to a specific student, found via
// a search bar (matches PGP ID, name, or email) — skips the student's own booking
// action entirely. Same confirmation email + calendar invite goes out as a normal
// self-service booking.
function AllocateSheet({ slot, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { pgpId, name, email, cohortLabel }
  const [focus, setFocus] = useState("overall");
  const allocate = useAllocateSlot();

  // Only search while the mentor is still typing — once a student is picked, the
  // dropdown closes and re-editing the text clears the selection.
  const { data: results = [], isLoading: searching } = useAllocateStudentSearch(selected ? "" : query);

  const handlePick = (student) => {
    setSelected(student);
    setQuery(`${student.name} · PGP-${student.pgpId}`);
  };

  const handleQueryChange = (value) => {
    setQuery(value);
    if (selected) setSelected(null);
  };

  const handleSubmit = () => {
    if (!selected) return;
    allocate.mutate(
      { slotId: slot.id, pgpId: selected.pgpId, focus },
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl z-50 p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.12)]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-black text-emerald-950 mb-0.5">Allocate Slot</h3>
        <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">{slot.time} · {slot.venue}</p>

        <div className="space-y-3 mb-5">
          <div className="relative">
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Student</label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-900/30" />
              <input
                type="text" placeholder="Search by PGP ID or name…" value={query} autoFocus
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-emerald-950 outline-none"
              />
            </div>

            {!selected && query.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-emerald-900/10 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                {searching ? (
                  <div className="px-4 py-3 text-xs font-bold text-emerald-800/40">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-xs font-bold text-emerald-800/40">No students found</div>
                ) : (
                  results.map((s) => (
                    <button
                      key={s.pgpId} type="button" onClick={() => handlePick(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-emerald-900/5 last:border-0"
                    >
                      <div className="text-sm font-bold text-emerald-950">{s.name}</div>
                      <div className="text-[11px] font-semibold text-emerald-700/60">
                        PGP-{s.pgpId} · {s.email}{s.cohortLabel ? ` · ${s.cohortLabel}` : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Focus</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(FOCUS_LABELS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFocus(key)}
                  className={`py-2 rounded-xl text-[11px] font-bold border transition-colors ${focus === key ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[#F5F7FA] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {allocate.error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {allocate.error.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={allocate.isPending || !selected}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {allocate.isPending ? "Allocating…" : "Confirm Booking for This Student"}
        </button>
        <p className="text-[10px] font-semibold text-emerald-700/40 text-center mt-3">
          Books this slot immediately — no action needed from the student. They'll get the usual confirmation email.
        </p>
      </div>
    </>
  );
}

// ── Meeting Link Row ───────────────────────────────────────────────────────────
// Lets a mentor add or edit a slot's Google Meet (or other) link at any time —
// at creation, or "later somewhere" once the batch already exists.
function MeetingLinkRow({ slotId, currentLink }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentLink ?? "");
  const setLink = useSetSlotMeetingLink();

  useEffect(() => { setValue(currentLink ?? ""); }, [currentLink]);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <input
          type="url"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="flex-1 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold outline-none min-w-0"
        />
        <button
          type="button"
          disabled={setLink.isPending}
          onClick={() => setLink.mutate({ slotId, meetingLink: value.trim() }, { onSuccess: () => setEditing(false) })}
          className="text-[10px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
        >
          {setLink.isPending ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-emerald-700/50 hover:text-emerald-900 shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return currentLink ? (
    <div className="flex items-center gap-1.5 mt-1.5">
      <a
        href={currentLink}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] font-bold text-emerald-700 underline truncate"
      >
        {currentLink}
      </a>
      <button type="button" onClick={() => setEditing(true)} className="text-emerald-700/50 hover:text-emerald-900 shrink-0">
        <Pencil size={11} />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1"
    >
      <LinkIcon size={10} /> Add Meet Link
    </button>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({ session, onAttendance, pendingBookingId }) {
  const [lateSheetOpen, setLateSheetOpen] = useState(false);
  const [rescheduleSheetOpen, setRescheduleSheetOpen] = useState(false);
  const isPending = pendingBookingId === session.bookingId;

  return (
    <div className="relative">
      <div className="p-4">
        {/* Date + delay badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50">
            {session.date}
          </span>
          {session.delayMinutes > 0 && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
              <Clock size={9} /> Running {session.delayMinutes}m late
            </span>
          )}
        </div>

        {/* Student info */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-[15px] text-emerald-950">{session.student.name}</h3>
            <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
              PGP-{session.student.pgp}
              <span className="text-emerald-900/20 mx-1">|</span>
              {FOCUS_LABELS[session.student.purpose] ?? session.student.purpose}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-1 rounded">
              {session.time}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700/50">{session.venue}</span>
          </div>
        </div>

        {session.venue?.toLowerCase().includes("online") && (
          <MeetingLinkRow slotId={session.id} currentLink={session.meetingLink} />
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onAttendance(session.bookingId, "ATTENDED")}
            disabled={isPending}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <CheckCircle size={14} />
            {isPending ? "Saving…" : "Attended"}
          </button>
          <button
            onClick={() => onAttendance(session.bookingId, "NO_SHOW")}
            disabled={isPending}
            className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <XCircle size={14} />
            {isPending ? "Saving…" : "No Show"}
          </button>
          <button
            onClick={() => setLateSheetOpen(true)}
            className="px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition-colors"
            title="Running late"
          >
            <Clock size={14} />
          </button>
          <button
            onClick={() => setRescheduleSheetOpen(true)}
            className="px-3 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition-colors"
            title="Reschedule"
          >
            <Calendar size={14} />
          </button>
          {session.student.email && (
            <a
              href={`mailto:${session.student.email}`}
              className="px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60 transition-colors"
              title="Email student"
            >
              <Mail size={14} />
            </a>
          )}
        </div>
      </div>

      {lateSheetOpen && (
        <RunningLateSheet session={session} onClose={() => setLateSheetOpen(false)} />
      )}
      {rescheduleSheetOpen && (
        <RescheduleSheet session={session} onClose={() => setRescheduleSheetOpen(false)} />
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useMentorDashboard();
  const bookedSessions = data?.bookedSessions ?? [];
  const availableSlots = data?.availableSlots ?? [];
  const cohortStats    = data?.cohortStats ?? { totalMentees: 0, totalSlotsTaken: 0 };

  const attendanceMutation  = useMarkAttendance();
  const deleteSlotMutation  = useDeleteSlot();
  const createSlotsMutation = useCreateSlots();
  const bulkDeleteMutation  = useBulkDeleteSlots();
  const bulkLinkMutation    = useBulkSetMeetingLink();
  const bulkPublishMutation = useBulkPublishSlots();

  const [pendingBookingId, setPendingBookingId] = useState(null);

  // Bulk slot selection (Open Slots list)
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [bulkLinkValue, setBulkLinkValue] = useState("");
  const [bulkLinkEditing, setBulkLinkEditing] = useState(false);

  // Allocate-by-PGP-ID sheet (per open slot)
  const [allocateSlotTarget, setAllocateSlotTarget] = useState(null);

  // Slot creation form state
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [slotDate, setSlotDate]       = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime]     = useState("14:00");
  const [endTime, setEndTime]         = useState("16:00");
  const [slotDuration, setSlotDuration] = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState("Library (In-Person)");
  const [meetingLink, setMeetingLink] = useState("");
  const [cohortOnly, setCohortOnly]   = useState(false);
  const [publishNow, setPublishNow]   = useState(true);

  useEffect(() => {
    document.body.style.overflow = isCreateSheetOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isCreateSheetOpen]);

  // Live slot count calculation — guard against 0/blank custom duration (would
  // otherwise divide by zero and show an "Infinity slots" preview)
  const toMins = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const slotCount = slotDuration > 0
    ? Math.max(0, Math.floor((toMins(endTime) - toMins(startTime)) / slotDuration))
    : 0;
  const isOnlineVenue = selectedVenue.toLowerCase().includes("online");

  const handleAttendance = (bookingId, status) => {
    setPendingBookingId(bookingId);
    attendanceMutation.mutate(
      { bookingId, status },
      {
        onSuccess: () => setPendingBookingId(null),
        onError:   (err) => { setPendingBookingId(null); alert(err.message); },
      },
    );
  };

  const handleDeleteSlot = (slotId) => {
    deleteSlotMutation.mutate(slotId, {
      onError: (err) => alert(err.message),
    });
  };

  const toggleSlotSelected = (slotId) => {
    setSelectedSlotIds((prev) => (prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]));
  };
  const toggleSelectAll = () => {
    setSelectedSlotIds((prev) => (prev.length === availableSlots.length ? [] : availableSlots.map((s) => s.id)));
  };
  const clearSelection = () => { setSelectedSlotIds([]); setBulkLinkEditing(false); setBulkLinkValue(""); };

  const handleBulkDelete = () => {
    if (selectedSlotIds.length === 0) return;
    if (!confirm(`Delete ${selectedSlotIds.length} selected slot${selectedSlotIds.length !== 1 ? "s" : ""}? Slots with existing bookings will be skipped.`)) return;
    bulkDeleteMutation.mutate(selectedSlotIds, {
      onSuccess: (res) => {
        clearSelection();
        if (res.skipped?.length > 0) alert(`${res.deleted} slot(s) deleted. ${res.skipped.length} skipped (already booked).`);
      },
      onError: (err) => alert(err.message),
    });
  };

  const handleBulkSetLink = () => {
    if (selectedSlotIds.length === 0) return;
    bulkLinkMutation.mutate(
      { slotIds: selectedSlotIds, meetingLink: bulkLinkValue.trim() },
      { onSuccess: clearSelection, onError: (err) => alert(err.message) },
    );
  };

  const handleBulkPublish = () => {
    if (selectedSlotIds.length === 0) return;
    bulkPublishMutation.mutate(selectedSlotIds, {
      onSuccess: clearSelection,
      onError: (err) => alert(err.message),
    });
  };

  const handleGenerateSlots = () => {
    if (slotCount < 1) return;
    const startDateTime = new Date(`${slotDate}T${startTime}:00`).toISOString();
    const endDateTime   = new Date(`${slotDate}T${endTime}:00`).toISOString();
    createSlotsMutation.mutate(
      {
        startTime: startDateTime,
        endTime: endDateTime,
        slotDuration,
        venue: selectedVenue,
        cohortOnly,
        publish: publishNow,
        ...(isOnlineVenue && meetingLink.trim() && { meetingLink: meetingLink.trim() }),
      },
      { onSuccess: () => { setIsCreateSheetOpen(false); setMeetingLink(""); setPublishNow(true); } },
    );
  };

  const isCreating = createSlotsMutation.isPending;
  const createError = createSlotsMutation.error?.message ?? null;

  return (
    <div className="min-h-screen app-bg text-emerald-950 font-sans pb-24">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-[#F5F7FA] shadow-2xl relative flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-emerald-900 px-5 pt-4 pb-6 rounded-b-3xl shadow-lg relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-white font-bold">
              <Shield size={18} className="text-emerald-400" /> Mentor Console
            </div>
            <button
              onClick={() => navigate("/mentor")}
              className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-inner border border-emerald-800 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Shield size={12} className="text-emerald-400" /> Shukracharya
            </button>
            <AvatarMenu variant="dark" />
          </div>

          {/* Cohort Pulse */}
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-emerald-50 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} /> My Cohort
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-white">
                  {isLoading ? "—" : cohortStats.totalMentees}
                </div>
                <div className="text-[9px] text-emerald-200/80 font-bold uppercase mt-1">Total Mentees</div>
              </div>
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-emerald-400">
                  {isLoading ? "—" : cohortStats.totalSlotsTaken}
                </div>
                <div className="text-[9px] text-emerald-200/80 font-bold uppercase mt-1">Slots Taken</div>
              </div>
            </div>
            <button
              onClick={() => navigate("/mentor/cohort")}
              className="w-full bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-white border border-white/10"
            >
              View Cohort Details <ChevronRight size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs font-bold text-red-700">
              {error.message}
            </div>
          )}

          {/* Booked Sessions */}
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
              Upcoming Sessions
            </h2>
            {bookedSessions.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                {bookedSessions.length}
              </span>
            )}
          </div>
          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-6 relative">
            {isLoading ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
            ) : bookedSessions.length === 0 ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                No upcoming sessions — release slots below
              </div>
            ) : (
              bookedSessions.map((session) => (
                <SessionCard
                  key={session.bookingId}
                  session={session}
                  onAttendance={handleAttendance}
                  pendingBookingId={pendingBookingId}
                />
              ))
            )}
          </div>

          {/* Available Slots */}
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
              Open Slots
            </h2>
            {availableSlots.length > 0 && (
              <button onClick={toggleSelectAll} className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900">
                {selectedSlotIds.length === availableSlots.length ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>

          {selectedSlotIds.length > 0 && (
            <div className="bg-emerald-900 text-white rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold mr-auto">{selectedSlotIds.length} selected</span>
              {bulkLinkEditing ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="url" autoFocus placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    value={bulkLinkValue} onChange={(e) => setBulkLinkValue(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-semibold text-white placeholder:text-white/40 outline-none min-w-0"
                  />
                  <button onClick={handleBulkSetLink} disabled={bulkLinkMutation.isPending}
                    className="text-xs font-bold bg-white text-emerald-900 px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50">
                    {bulkLinkMutation.isPending ? "…" : "Save"}
                  </button>
                  <button onClick={() => setBulkLinkEditing(false)} className="text-white/60 hover:text-white shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={handleBulkPublish} disabled={bulkPublishMutation.isPending} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                    <Send size={12} /> {bulkPublishMutation.isPending ? "Publishing…" : "Publish"}
                  </button>
                  <button onClick={() => setBulkLinkEditing(true)} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <LinkIcon size={12} /> Set Meet Link
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending} className="text-xs font-bold bg-red-500/90 hover:bg-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                    <Trash2 size={12} /> {bulkDeleteMutation.isPending ? "Deleting…" : `Delete (${selectedSlotIds.length})`}
                  </button>
                  <button onClick={clearSelection} className="text-white/60 hover:text-white px-1">
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-8">
            {isLoading ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
            ) : availableSlots.length === 0 ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                No open slots — tap + to release some
              </div>
            ) : (
              availableSlots.map((slot) => (
                <div key={slot.id} className="p-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedSlotIds.includes(slot.id)}
                    onChange={() => toggleSlotSelected(slot.id)}
                    className="mt-1 w-4 h-4 rounded border-emerald-300 text-emerald-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-emerald-950 text-sm mb-1">{slot.time}</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-emerald-700/60">{slot.venue}</span>
                      {slot.cohortOnly && (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Cohort Only</span>
                      )}
                      {!slot.published && (
                        <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Draft</span>
                      )}
                    </div>
                    {slot.venue?.toLowerCase().includes("online") && (
                      <MeetingLinkRow slotId={slot.id} currentLink={slot.meetingLink} />
                    )}
                  </div>
                  <button
                    onClick={() => setAllocateSlotTarget(slot)}
                    className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                    title="Allocate to a specific student"
                  >
                    <UserPlus size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={deleteSlotMutation.isPending}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {allocateSlotTarget && (
            <AllocateSheet slot={allocateSlotTarget} onClose={() => setAllocateSlotTarget(null)} />
          )}
          <AppFooter />
        </main>

        {/* FAB */}
        <button
          onClick={() => { createSlotsMutation.reset(); setIsCreateSheetOpen(true); }}
          className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-900 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.3)] active:scale-95 transition-transform z-20"
        >
          <Plus size={24} />
        </button>

        {/* Slot Creation Sheet Backdrop */}
        <div
          className={`absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40 transition-opacity duration-300
            ${isCreateSheetOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
          onClick={() => !isCreating && setIsCreateSheetOpen(false)}
        />

        {/* Slot Creation Sheet */}
        <div
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isCreateSheetOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-black text-emerald-950 mb-1">Release New Slots</h3>
          <p className="text-xs font-semibold text-emerald-700/70 mb-6">Create customised booking blocks.</p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Date</label>
              <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none" />
              </div>
            </div>

            {/* Live slot count preview */}
            {slotCount > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Preview</span>
                <span className="text-sm font-black text-emerald-700">
                  {slotCount} slot{slotCount !== 1 ? "s" : ""} × {slotDuration}min each
                </span>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                <span className="text-xs font-bold text-red-600">End time must be after start time</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Duration Per Slot</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30].map((d) => (
                  <button key={d} type="button" onClick={() => { setIsCustomDuration(false); setSlotDuration(d); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${!isCustomDuration && slotDuration === d ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[#F5F7FA] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                    {d}m
                  </button>
                ))}
                <button type="button" onClick={() => setIsCustomDuration(true)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${isCustomDuration ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[#F5F7FA] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                  Custom
                </button>
              </div>
              {isCustomDuration && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number" min="1" max="180" placeholder="Minutes per slot…"
                    value={slotDuration || ""}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="flex-1 bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none"
                  />
                  <span className="text-xs font-bold text-emerald-700/60">minutes</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Venue</label>
              <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none appearance-none">
                <option>Library (In-Person)</option>
                <option>Online (Google Meet)</option>
              </select>
            </div>

            {isOnlineVenue && (
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  Google Meet Link <span className="text-emerald-700/40 font-semibold normal-case">(optional — can add later)</span>
                </label>
                <input
                  type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
                  className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <div>
                <div className="text-sm font-bold text-emerald-950">Reserve for Cohort</div>
                <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">Only your mentees can book this block</div>
              </div>
              <div onClick={() => setCohortOnly(!cohortOnly)}
                className={`w-12 h-6 rounded-full ${cohortOnly ? "bg-emerald-500" : "bg-slate-300"} relative cursor-pointer transition-colors`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${cohortOnly ? "left-7" : "left-1"}`} />
              </div>
            </div>

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <div>
                <div className="text-sm font-bold text-emerald-950">Publish Immediately</div>
                <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">
                  {publishNow ? "Visible and bookable as soon as it's created" : "Saved as a draft — publish later when ready"}
                </div>
              </div>
              <div onClick={() => setPublishNow(!publishNow)}
                className={`w-12 h-6 rounded-full ${publishNow ? "bg-emerald-500" : "bg-slate-300"} relative cursor-pointer transition-colors`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${publishNow ? "left-7" : "left-1"}`} />
              </div>
            </div>
          </div>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-red-700">{createError}</p>
            </div>
          )}

          <button
            onClick={handleGenerateSlots}
            disabled={isCreating || slotCount < 1}
            className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isCreating
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Plus size={18} /> Generate {slotCount > 0 ? `${slotCount} ` : ""}Slot{slotCount !== 1 ? "s" : ""}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
