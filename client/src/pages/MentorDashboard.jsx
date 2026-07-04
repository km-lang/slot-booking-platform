import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Plus, Users, CheckCircle, XCircle,
  ChevronRight, Trash2, AlertTriangle, Calendar,
  Clock, Mail, Link as LinkIcon, Pencil, X,
  Send, UserPlus, Search, ShieldAlert, RefreshCw,
} from "lucide-react";
import {
  useMentorDashboard, useMarkAttendance,
  useDeleteSlot, useSetSlotDelay, useSetSlotMeetingLink,
  useBulkDeleteSlots, useBulkSetMeetingLink,
  useBulkPublishSlots, useAllocateSlot, useAllocateStudentSearch,
  useApplyStrike, useReleaseRemainingTime,
} from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import CollapsibleSection from "../components/CollapsibleSection";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
};

const DELAY_PRESETS = [5, 10, 15, 20, 30];

const timeAgo = (iso) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

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
      <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl bg-white rounded-t-3xl z-50 p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] max-h-[85vh] overflow-y-auto">
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
    setQuery(`${student.name} · ${student.pgpId}`);
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
      <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-md md:max-w-2xl lg:max-w-4xl bg-white rounded-t-3xl z-50 p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
        <div className="flex items-start justify-between mb-0.5">
          <h3 className="text-lg font-black text-emerald-950">Allocate Slot</h3>
          <button onClick={onClose} className="text-emerald-700/40 hover:text-emerald-900 -mr-1 -mt-1 p-1" title="Close">
            <X size={18} />
          </button>
        </div>
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
                        {s.pgpId} · {s.email}{s.cohortLabel ? ` · ${s.cohortLabel}` : ""}
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
  const navigate = useNavigate();
  const [lateSheetOpen, setLateSheetOpen] = useState(false);
  const isPending = pendingBookingId === session.bookingId;
  // Server rejects attendance marking before the session starts — mirrored here so
  // mentors see a disabled state instead of tapping the button and hitting an alert().
  const hasStarted = new Date(session.startTime) <= new Date();

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
              {session.student.pgp}
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
            disabled={isPending || !hasStarted}
            title={!hasStarted ? "Available once the session starts" : undefined}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <CheckCircle size={14} />
            {isPending ? "Saving…" : "Attended"}
          </button>
          <button
            onClick={() => onAttendance(session.bookingId, "NO_SHOW")}
            disabled={isPending || !hasStarted}
            title={!hasStarted ? "Available once the session starts" : undefined}
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
            onClick={() => navigate(`/mentor/slots/${session.id}/reschedule`, { state: { session } })}
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
    </div>
  );
}

// ── History Session Row ───────────────────────────────────────────────────────
function HistorySessionRow({ session }) {
  const attended = session.status === "ATTENDED";
  return (
    <div className="p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-bold text-sm text-emerald-950 truncate">{session.student.name}</h3>
        <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
          {session.student.pgp}
          <span className="text-emerald-900/20 mx-1">|</span>
          {session.date} · {session.time}
          <span className="text-emerald-900/20 mx-1">|</span>
          {FOCUS_LABELS[session.focus] ?? session.focus}
        </p>
      </div>
      <span
        className={`shrink-0 flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg border
          ${attended
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-600 border-red-200"}`}
      >
        {attended ? <CheckCircle size={12} /> : <XCircle size={12} />}
        {attended ? "Attended" : "No Show"}
      </span>
    </div>
  );
}

// ── Cancelled Session Row ─────────────────────────────────────────────────────
// A booking the student cancelled themselves. Cancelling is never auto-penalised —
// this is the mentor's one chance to review it and, at their own discretion,
// apply a strike. Once applied it can't be undone from here (server enforces
// one strike per booking).
function CancelledSessionRow({ session }) {
  const applyStrike = useApplyStrike();

  const handleStrike = () => {
    if (!confirm(`Apply a strike to ${session.student.name} for this cancelled session? This may also trigger a booking ban depending on their strike history.`)) return;
    applyStrike.mutate(session.bookingId, {
      onError: (err) => alert(err.message),
    });
  };

  return (
    <div className="p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-bold text-sm text-emerald-950 truncate">{session.student.name}</h3>
        <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
          {session.student.pgp}
          <span className="text-emerald-900/20 mx-1">|</span>
          {session.date} · {session.time}
        </p>
        <p className="text-[10px] font-semibold text-amber-700/70 mt-0.5">
          Cancelled {timeAgo(session.cancelledAt)}
        </p>
      </div>
      {session.hasStrike ? (
        <span className="shrink-0 flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg">
          <ShieldAlert size={12} /> Struck
        </span>
      ) : (
        <button
          onClick={handleStrike}
          disabled={applyStrike.isPending}
          className="shrink-0 flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <ShieldAlert size={13} /> {applyStrike.isPending ? "…" : "Mark Strike"}
        </button>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useMentorDashboard();
  const bookedSessions    = data?.bookedSessions ?? [];
  const ongoingSessions   = data?.ongoingSessions ?? [];
  const availableSlots    = data?.availableSlots ?? [];
  const expiredSlots      = data?.expiredSlots ?? [];
  const cancelledSessions = data?.cancelledSessions ?? [];
  const historySessions   = data?.historySessions ?? [];
  const cohortStats       = data?.cohortStats ?? { totalMentees: 0, totalSlotsTaken: 0 };

  const attendanceMutation  = useMarkAttendance();
  const deleteSlotMutation  = useDeleteSlot();
  const releaseRemainingMutation = useReleaseRemainingTime();
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

  const handleReleaseRemainingTime = (slotId) => {
    releaseRemainingMutation.mutate(slotId, {
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

  // Only offer bulk-publish when the selection actually includes a draft — every
  // slot already published has nothing for that action to do.
  const hasDraftSelected = selectedSlotIds.some(
    (id) => availableSlots.find((s) => s.id === id)?.published === false,
  );

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

  return (
    <div className="min-h-screen-safe app-bg text-emerald-950 font-sans">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen-safe bg-[#F5F7FA] shadow-2xl relative flex flex-col">

        {/* Header — identity bar only; stays put while the page scrolls beneath it */}
        <header className="sticky top-0 z-30 bg-emerald-900 px-5 header-safe-top pb-4 shadow-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm shrink-0">
            <Shield size={18} className="text-emerald-400" /> Mentor Console
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/mentor")}
              className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-widest px-3 py-2 rounded-full shadow-inner border border-emerald-800 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Shield size={12} className="text-emerald-400" /> Shukracharya
            </button>
            <AvatarMenu variant="dark" />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-safe-8 space-y-6">
          {/* Create Slots — the mentor's primary action, always the first thing in view */}
          <button
            onClick={() => navigate("/mentor/slots/new")}
            className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Create Slots
          </button>

          {/* Cohort Pulse */}
          <div className="bg-emerald-900 rounded-2xl p-4 shadow-sm">
            <h3 className="text-emerald-50 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-4">
              <Users size={14} /> My Cohort
            </h3>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs font-bold text-red-700">
              {error.message}
            </div>
          )}

          {/* Ongoing Sessions — already started, attendance not yet marked */}
          <CollapsibleSection
            title="Ongoing Sessions"
            count={ongoingSessions.length}
            badgeClassName="bg-red-100 text-red-700"
            defaultOpen
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 relative">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : ongoingSessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No sessions in progress right now
                </div>
              ) : (
                ongoingSessions.map((session) => (
                  <SessionCard
                    key={session.bookingId}
                    session={session}
                    onAttendance={handleAttendance}
                    pendingBookingId={pendingBookingId}
                  />
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Upcoming Sessions */}
          <CollapsibleSection
            title="Upcoming Sessions"
            count={bookedSessions.length}
            badgeClassName="bg-emerald-100 text-emerald-700"
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 relative">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : bookedSessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No upcoming sessions — release slots above
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
          </CollapsibleSection>

          {/* Cancelled Sessions — review & optionally strike */}
          <CollapsibleSection
            title="Cancelled Sessions"
            count={cancelledSessions.length}
            badgeClassName="bg-amber-100 text-amber-700"
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : cancelledSessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No recent cancellations
                </div>
              ) : (
                cancelledSessions.map((session) => (
                  <CancelledSessionRow key={session.bookingId} session={session} />
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* History — past sessions already marked Attended / No Show */}
          <CollapsibleSection
            title="History"
            count={historySessions.length}
            badgeClassName="bg-slate-200 text-slate-600"
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : historySessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No sessions marked Attended or No Show yet
                </div>
              ) : (
                historySessions.map((session) => (
                  <HistorySessionRow key={session.bookingId} session={session} />
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Open Slots */}
          <CollapsibleSection
            title="Open Slots"
            count={availableSlots.length}
            badgeClassName="bg-emerald-100 text-emerald-700"
          >
            {availableSlots.length > 0 && (
              <div className="flex justify-end mb-2 px-1">
                <button onClick={toggleSelectAll} className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900">
                  {selectedSlotIds.length === availableSlots.length ? "Deselect all" : "Select all"}
                </button>
              </div>
            )}

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
                    {hasDraftSelected && (
                      <button onClick={handleBulkPublish} disabled={bulkPublishMutation.isPending} className="text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                        <Send size={12} /> {bulkPublishMutation.isPending ? "Publishing…" : "Publish"}
                      </button>
                    )}
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

            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : availableSlots.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No open slots — tap Create Slots above
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
                        {slot.published ? (
                          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Published</span>
                        ) : (
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
          </CollapsibleSection>

          {/* Expired Slots — released but nobody booked before the start time passed */}
          <CollapsibleSection
            title="Expired Slots"
            count={expiredSlots.length}
            badgeClassName="bg-slate-200 text-slate-600"
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
              {isLoading ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : expiredSlots.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No expired slots
                </div>
              ) : (
                expiredSlots.map((slot) => {
                  // The server (releaseRemainingTime) has its own 5s-buffer check and
                  // will 400 if this races past the true deadline — this is just the
                  // UI hint for whether the action makes sense to offer at all.
                  const hasRemainingTime = new Date(slot.endTime) > new Date();
                  return (
                    <div key={slot.id} className="p-4 flex items-start gap-3">
                      <Clock size={16} className="mt-1 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-emerald-950 text-sm mb-1">{slot.time}</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-emerald-700/60">{slot.venue}</span>
                          {slot.cohortOnly && (
                            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Cohort Only</span>
                          )}
                          <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{slot.reason}</span>
                        </div>
                      </div>
                      {hasRemainingTime && (
                        <button
                          onClick={() => handleReleaseRemainingTime(slot.id)}
                          disabled={releaseRemainingMutation.isPending}
                          className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                          title="Release the remaining time as a new bookable slot"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={deleteSlotMutation.isPending}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </CollapsibleSection>

          {allocateSlotTarget && (
            <AllocateSheet slot={allocateSlotTarget} onClose={() => setAllocateSlotTarget(null)} />
          )}
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
