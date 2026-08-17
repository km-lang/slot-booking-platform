import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus, Users, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Trash2, AlertTriangle, Calendar,
  Clock, Mail, Link as LinkIcon, Pencil, X,
  Send, UserPlus, UserMinus, Search, ShieldAlert, UserCog, ArrowLeftRight,
  CalendarRange, MapPin,
} from "lucide-react";
import {
  useMentorDashboard, useMentorHistory, useMarkAttendance,
  useDeleteSlot, useSetSlotDelay, useSetSlotMeetingLink, useSetSlotVenue,
  useBulkDeleteSlots, useBulkSetMeetingLink,
  useBulkPublishSlots, useAllocateSlot, useAllocateStudentSearch,
  useApplyStrike, useReassignBooking, useUnassignBooking, useSwapBookings,
  useMentorHoursReleased,
} from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import CollapsibleSection from "../components/CollapsibleSection";
import Sheet from "../components/ui/Sheet";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import IconButton from "../components/ui/IconButton";
import { VENUE_OPTIONS, isOnlineVenue as checkIsOnlineVenue } from "../lib/venues";
import psLogo from "../assets/PSLogo.png";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
  cv_hr:   "CV-HR",
};

const SLOT_TYPE_LABELS = { GD: "Group Discussion", CASE: "Case Study", STOCK_PITCH: "Stock Pitch" };
const MULTI_PARTICIPANT_TYPES = ["GD", "CASE"];

const DELAY_PRESETS = [5, 10, 15, 20, 30];

const timeAgo = (iso) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// ── Running Late Sheet ────────────────────────────────────────────────────────
function RunningLateSheet({ session, isOpen, onClose }) {
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
    <Sheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl">
        <h3 className="text-lg font-black text-emerald-950 mb-0.5">Running Late?</h3>
        <p className="text-xs font-semibold text-emerald-700/60 mb-1">
          Session with{" "}
          <span className="text-emerald-800 font-bold">
            {session.participants?.length === 1
              ? session.participants[0].name
              : `${session.participants?.length ?? 0} participants`}
          </span>
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
                  : "bg-[var(--color-bg)] border-emerald-900/10 text-emerald-800 hover:bg-amber-50"}`}
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
            className={`flex-1 bg-[var(--color-bg)] border rounded-xl px-4 py-2.5 text-sm font-bold outline-none
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
    </Sheet>
  );
}

// ── Allocate Sheet ───────────────────────────────────────────────────────────────
// Lets a mentor directly hand a specific open slot to a specific student, found via
// a search bar (matches PGP ID, name, or email) — skips the student's own booking
// action entirely. Same confirmation email + calendar invite goes out as a normal
// self-service booking.
function AllocateSheet({ slot, isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { pgpId, name, email, cohortLabel }
  const [focus, setFocus] = useState("overall");
  const [role, setRole] = useState("SOLVER"); // CASE only — SOLVER is always valid, unlike SHADOW on a 1-seat slot
  const allocate = useAllocateSlot();
  const slotType = slot?.slotType ?? "CV";
  // This list only ever holds unbooked slots (seatsTaken is always 0 here), so a
  // capacity-1 CASE slot always needs its one seat to be the Solver — mirrors the
  // server-side guard in claimSlotAndCreateBooking / the student booking sheet.
  const lastSeatNeedsSolver = slotType === "CASE" && (slot?.seatsMax ?? 1) - (slot?.seatsTaken ?? 0) === 1;

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
    if (!selected || !slot) return;
    // role can be left over from a previously-opened slot (this sheet's state
    // isn't reset per-slot) — force it back to the only valid choice rather than
    // relying on the disabled button alone to have caught it.
    const effectiveRole = lastSeatNeedsSolver ? "SOLVER" : role;
    allocate.mutate(
      { slotId: slot.id, pgpId: selected.pgpId, focus: slotType === "CV" ? focus : undefined, role: slotType === "CASE" ? effectiveRole : undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl">
      {slot && (
        <>
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
                className="w-full bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-emerald-950 outline-none"
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
          {slotType === "CV" && (
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Focus</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FOCUS_LABELS).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setFocus(key)}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-colors ${focus === key ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[var(--color-bg)] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {slotType === "CASE" && (
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {["SOLVER", "SHADOW"].map((r) => (
                  <button key={r} type="button"
                    disabled={r === "SHADOW" && lastSeatNeedsSolver}
                    onClick={() => setRole(r)}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${role === r ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[var(--color-bg)] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                    {r === "SOLVER" ? "Solver" : "Shadow"}
                  </button>
                ))}
              </div>
              {lastSeatNeedsSolver && (
                <p className="text-[10px] font-bold text-amber-700 mt-2">
                  This slot has only one seat, so it must be filled as the Solver.
                </p>
              )}
            </div>
          )}
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
        </>
      )}
    </Sheet>
  );
}

// ── Reassign Sheet ───────────────────────────────────────────────────────────────
// Gives an already-booked session to a different student, found the same way as
// AllocateSheet (search by PGP ID/name/email). Same slot/time — just a new occupant.
function ReassignSheet({ booking, isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { pgpId, name, email, cohortLabel }
  const reassign = useReassignBooking();

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
    if (!selected || !booking) return;
    reassign.mutate(
      { bookingId: booking.bookingId, pgpId: selected.pgpId },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl">
      {booking && (
        <>
        <div className="flex items-start justify-between mb-0.5">
          <h3 className="text-lg font-black text-emerald-950">Reassign Session</h3>
          <button onClick={onClose} className="text-emerald-700/40 hover:text-emerald-900 -mr-1 -mt-1 p-1" title="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">
          Currently {booking.student.name} · {booking.date} · {booking.time}
        </p>

        <div className="relative mb-5">
          <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">New Student</label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-900/30" />
            <input
              type="text" placeholder="Search by PGP ID or name…" value={query} autoFocus
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-emerald-950 outline-none"
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

        {reassign.error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {reassign.error.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={reassign.isPending || !selected}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {reassign.isPending ? "Reassigning…" : "Reassign to This Student"}
        </button>
        <p className="text-[10px] font-semibold text-emerald-700/40 text-center mt-3">
          {booking.student.name} will no longer see this session — they're notified by email, no strike applied.
        </p>
        </>
      )}
    </Sheet>
  );
}

// ── Swap Sheet ─────────────────────────────────────────────────────────────────
// Trades which student sits on which of the mentor's own two sessions — picked
// from the already-loaded dashboard data, not a fresh search.
function SwapSheet({ booking, candidates, isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // a candidate session
  const swap = useSwapBookings();

  const filtered = candidates.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.student.name.toLowerCase().includes(q) || c.student.pgp.toLowerCase().includes(q);
  });

  const handleSubmit = () => {
    if (!selected || !booking) return;
    swap.mutate(
      { bookingIdA: booking.bookingId, bookingIdB: selected.bookingId },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl">
      {booking && (
        <>
        <div className="flex items-start justify-between mb-0.5">
          <h3 className="text-lg font-black text-emerald-950">Swap Sessions</h3>
          <button onClick={onClose} className="text-emerald-700/40 hover:text-emerald-900 -mr-1 -mt-1 p-1" title="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-[11px] font-semibold text-emerald-700/50 mb-5">
          {booking.student.name} · {booking.date} · {booking.time}
        </p>

        <div className="mb-5">
          <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Swap With</label>
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-900/30" />
            <input
              type="text" placeholder="Filter by name or PGP ID…" value={query} autoFocus
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-emerald-950 outline-none"
            />
          </div>
          <div className="border border-emerald-900/10 rounded-xl max-h-64 overflow-y-auto divide-y divide-emerald-900/5">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs font-bold text-emerald-800/40">No other upcoming sessions</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.bookingId} type="button" onClick={() => setSelected(c)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${selected?.bookingId === c.bookingId ? "bg-emerald-100" : "hover:bg-emerald-50"}`}
                >
                  <div className="text-sm font-bold text-emerald-950">{c.student.name}</div>
                  <div className="text-[11px] font-semibold text-emerald-700/60">
                    {c.student.pgp} · {c.date} · {c.time}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {swap.error && (
          <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {swap.error.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={swap.isPending || !selected}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
        >
          {swap.isPending ? "Swapping…" : "Swap These Sessions"}
        </button>
        <p className="text-[10px] font-semibold text-emerald-700/40 text-center mt-3">
          Both students move to each other's time — they're notified by email, no strike applied either way.
        </p>
        </>
      )}
    </Sheet>
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

// ── Venue Editor ────────────────────────────────────────────────────────────
// Lets a mentor change an unbooked slot's location — e.g. convert a Library
// slot to GMeet before anyone's booked it — without deleting and recreating it.
function VenueEditor({ slotId, currentVenue, currentLink }) {
  const [editing, setEditing] = useState(false);
  const [venue, setVenue] = useState(currentVenue);
  const [link, setLink] = useState(currentLink ?? "");
  const setSlotVenue = useSetSlotVenue();

  useEffect(() => { setVenue(currentVenue); setLink(currentLink ?? ""); }, [currentVenue, currentLink]);

  // Keeps a venue the slot already has (even if since dropped from the standard
  // list) selectable, instead of silently switching the <select> to some other option.
  const venueOptions = currentVenue && !VENUE_OPTIONS.includes(currentVenue)
    ? [currentVenue, ...VENUE_OPTIONS]
    : VENUE_OPTIONS;
  const willBeOnline = checkIsOnlineVenue(venue);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-[10px] font-bold text-emerald-700/60 hover:text-emerald-900 mt-0.5"
      >
        <MapPin size={10} /> {currentVenue} <Pencil size={9} className="opacity-50" />
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="flex-1 min-w-0 bg-white border border-emerald-300 rounded-lg px-2 py-1.5 text-[11px] font-semibold outline-none"
        >
          {venueOptions.map((v) => <option key={v}>{v}</option>)}
        </select>
        <button
          type="button"
          disabled={setSlotVenue.isPending}
          onClick={() => setSlotVenue.mutate(
            { slotId, venue, meetingLink: willBeOnline ? link.trim() : "" },
            { onSuccess: () => setEditing(false) },
          )}
          className="text-[10px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
        >
          {setSlotVenue.isPending ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-emerald-700/50 hover:text-emerald-900 shrink-0">
          <X size={14} />
        </button>
      </div>
      {willBeOnline && (
        <input
          type="url"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold outline-none"
        />
      )}
      {setSlotVenue.error && (
        <p className="text-[10px] font-bold text-red-600">{setSlotVenue.error.message}</p>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  SOLVER: "bg-purple-100 text-purple-800",
  SHADOW: "bg-slate-200 text-slate-600",
};

// One participant's own action row — attendance/unassign/reassign/swap/email all
// operate on this specific bookingId, not the slot as a whole. Reassign/Swap take
// a plain { bookingId, student: {name, pgp}, date, time, endTime } shape, which is
// exactly what ReassignSheet/SwapSheet already expect (they were written against
// a single booking, not a slot, so no changes were needed there for GD/CASE).
function ParticipantActions({ participant, session, onAttendance, pendingBookingId, onReassign, onSwap, onUnassign, pendingUnassignId, hasStarted, isOverdue }) {
  const isPending = pendingBookingId === participant.bookingId;
  const isUnassignPending = pendingUnassignId === participant.bookingId;
  const asBooking = { bookingId: participant.bookingId, student: { name: participant.name, pgp: participant.pgp }, date: session.date, time: session.time, endTime: session.endTime, slotType: session.slotType, role: participant.role ?? null };

  return (
    <>
      <IconButton
        icon={CheckCircle}
        label={isPending ? "Saving…" : "Mark Attended"}
        onClick={() => onAttendance(participant.bookingId, "ATTENDED")}
        disabled={isPending || !hasStarted}
        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200/60"
      />
      <IconButton
        icon={XCircle}
        label={isPending ? "Saving…" : "Mark No-Show"}
        onClick={() => onAttendance(participant.bookingId, "NO_SHOW")}
        disabled={isPending || !hasStarted}
        className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200/60"
      />
      {!hasStarted && (
        <IconButton
          icon={UserMinus}
          label={isUnassignPending ? "Unassigning…" : "Unassign Student"}
          onClick={() => onUnassign(participant.bookingId, participant.name)}
          disabled={isUnassignPending}
          className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200/60"
        />
      )}
      <IconButton
        icon={UserCog}
        label={isOverdue ? "Reassign — unavailable, session ended" : "Reassign to Different Student"}
        onClick={() => onReassign(asBooking)}
        disabled={isOverdue}
        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200/60"
      />
      <IconButton
        icon={ArrowLeftRight}
        label={isOverdue ? "Swap — unavailable, session ended" : "Swap With Another Student"}
        onClick={() => onSwap(asBooking)}
        disabled={isOverdue}
        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/60"
      />
      {participant.email && (
        <IconButton
          icon={Mail}
          label="Email Student"
          href={`mailto:${participant.email}`}
          className="bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
        />
      )}
    </>
  );
}

function SessionCard({ session, onAttendance, pendingBookingId, onReassign, onSwap, onDelete, onUnassign, pendingUnassignId }) {
  const navigate = useNavigate();
  const [lateSheetOpen, setLateSheetOpen] = useState(false);
  // Server rejects attendance marking before the session starts — mirrored here so
  // mentors see a disabled state instead of tapping the button and hitting an alert().
  const hasStarted = new Date(session.startTime) <= new Date();
  // Session time has fully passed with no attendance marked yet — distinguishes a
  // genuinely-in-progress session from backlog that needs the mentor's attention.
  const isOverdue = new Date(session.endTime) < new Date();
  const participants = session.participants ?? [];
  const isGroup = session.slotType === "GD" || session.slotType === "CASE";
  const participantProps = { session, onAttendance, pendingBookingId, onReassign, onSwap, onUnassign, pendingUnassignId, hasStarted, isOverdue };

  return (
    <div className="relative">
      <div className="p-4">
        {/* Date + delay badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50">
            {session.date}
          </span>
          {isOverdue && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
              <Clock size={9} /> Overdue — mark attendance
            </span>
          )}
          {!isOverdue && session.delayMinutes > 0 && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
              <Clock size={9} /> Running {session.delayMinutes}m late
            </span>
          )}
        </div>

        {isGroup ? (
          <>
            {/* Slot header — type + time/venue, shown once for the whole roster */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-[15px] text-emerald-950 flex items-center gap-2">
                  {session.slotType === "GD" ? "Group Discussion" : "Case Study"}
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-1.5 py-0.5 rounded">
                    {participants.length}/{session.capacity ?? participants.length} joined
                  </span>
                </h3>
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

            {/* One row per participant — each with its own attendance/reassign/swap/unassign */}
            <div className="space-y-2 my-3">
              {participants.map((p) => (
                <div key={p.bookingId} className="bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl p-3">
                  <div className="mb-2">
                    <span className="font-bold text-sm text-emerald-950">{p.name}</span>
                    <span className="text-[11px] font-bold text-emerald-700/60 ml-2">{p.pgp}</span>
                    {p.role && (
                      <span className={`ml-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${ROLE_BADGE[p.role] ?? ""}`}>
                        {p.role === "SOLVER" ? "Solver" : "Shadow"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ParticipantActions participant={p} {...participantProps} />
                  </div>
                </div>
              ))}
            </div>

            {/* Slot-level actions — apply to the whole GD/CASE slot, not one participant */}
            <div className="flex flex-wrap gap-2">
              <IconButton
                icon={Clock}
                label="Running Late"
                onClick={() => setLateSheetOpen(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/60"
              />
              <IconButton
                icon={Calendar}
                label="Reschedule"
                onClick={() => navigate(`/mentor/slots/${session.id}/reschedule`, { state: { session } })}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/60"
              />
              <IconButton
                icon={Trash2}
                label="Delete Slot"
                onClick={() => onDelete(session.id, null)}
                className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200/60"
              />
            </div>
          </>
        ) : (
          <>
            {/* CV / CV-HR — unchanged single-student layout */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-[15px] text-emerald-950">{participants[0]?.name}</h3>
                <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
                  {participants[0]?.pgp}
                  <span className="text-emerald-900/20 mx-1">|</span>
                  {FOCUS_LABELS[participants[0]?.purpose] ?? participants[0]?.purpose}
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

            {/* Actions — icon-only so they never overlap on narrow screens; each
                button's name shows via native title (desktop hover) or a long-press
                (touch — see IconButton) instead of inline text. */}
            <div className="flex flex-wrap gap-2">
              {participants[0] && <ParticipantActions participant={participants[0]} {...participantProps} />}
              <IconButton
                icon={Clock}
                label="Running Late"
                onClick={() => setLateSheetOpen(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/60"
              />
              <IconButton
                icon={Calendar}
                label="Reschedule"
                onClick={() => navigate(`/mentor/slots/${session.id}/reschedule`, { state: { session } })}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/60"
              />
              <IconButton
                icon={Trash2}
                label="Delete Slot"
                onClick={() => onDelete(session.id, participants[0]?.name)}
                className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200/60"
              />
            </div>
          </>
        )}
      </div>

      <RunningLateSheet session={session} isOpen={lateSheetOpen} onClose={() => setLateSheetOpen(false)} />
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
        {attended ? "Attended" : "No-Show"}
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const confirmStrike = () => {
    applyStrike.mutate(session.bookingId, {
      onSuccess: () => setConfirmOpen(false),
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
          onClick={() => setConfirmOpen(true)}
          disabled={applyStrike.isPending}
          className="shrink-0 flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <ShieldAlert size={13} /> {applyStrike.isPending ? "…" : "Mark Strike"}
        </button>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Apply a strike?"
        message={`Apply a strike to ${session.student.name} for this cancelled session? This may also trigger a booking ban depending on their strike history.`}
        confirmLabel="Apply Strike"
        danger
        pending={applyStrike.isPending}
        error={applyStrike.error?.message}
        onConfirm={confirmStrike}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ── Hours Released (date range) ───────────────────────────────────────────────
// Hours, not a slot count, since slots can be of any duration — lets the mentor
// see how many mentoring hours they've put on the calendar for a given window,
// scoped by the session's own date (slot startTime), not when it was created.
// The "N slots" sub-label counts occupied slots only (>=1 booking), matching the
// AIG accounting definition, not every slot released.
function HoursReleasedCard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const { data, isFetching, error } = useMentorHoursReleased(from, to);

  return (
    <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm p-4">
      <h3 className="text-emerald-950 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-3">
        <CalendarRange size={14} className="text-emerald-700" /> Hours Released
      </h3>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="flex-1 min-w-0 bg-emerald-50/50 border border-emerald-900/10 rounded-lg px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
        />
        <span className="text-emerald-700/50 text-xs font-bold shrink-0">to</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 min-w-0 bg-emerald-50/50 border border-emerald-900/10 rounded-lg px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
        />
      </div>
      {error ? (
        <div className="text-xs font-bold text-red-600">{error.message}</div>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black text-emerald-950">
              {isFetching ? "—" : `${data?.hours ?? 0}h`}
            </div>
            <div className="text-[9px] text-emerald-700/60 font-bold uppercase mt-0.5">Total Hours Released</div>
          </div>
          <div className="text-xs font-semibold text-emerald-700/70">
            {isFetching ? "" : `${data?.slotCount ?? 0} slot${data?.slotCount === 1 ? "" : "s"}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Slot-creation partial-skip notice, handed off via navigation state instead
  // of alert() (CreateSlotsFlow.jsx) — cleared immediately so it doesn't
  // resurface on a refresh or on navigating back to this page later.
  const [slotCreationNotice, setSlotCreationNotice] = useState(location.state?.slotCreationNotice ?? null);
  useEffect(() => {
    if (location.state?.slotCreationNotice) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useMentorDashboard();
  const bookedSessions    = data?.bookedSessions ?? [];
  const ongoingSessions   = data?.ongoingSessions ?? [];
  const availableSlots    = data?.availableSlots ?? [];
  const expiredSlots      = data?.expiredSlots ?? [];
  const cancelledSessions = data?.cancelledSessions ?? [];
  const historyCount      = data?.historyCount ?? 0;
  const cohortStats       = data?.cohortStats ?? { totalMentees: 0, totalSlotsTaken: 0 };

  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isFetching: historyFetching } = useMentorHistory(historyPage);
  const historySessions   = historyData?.historySessions ?? [];
  const historyTotalPages = historyData?.totalPages ?? 1;

  const attendanceMutation  = useMarkAttendance();
  const deleteSlotMutation  = useDeleteSlot();
  const unassignMutation    = useUnassignBooking();
  const bulkDeleteMutation  = useBulkDeleteSlots();
  const bulkLinkMutation    = useBulkSetMeetingLink();
  const bulkPublishMutation = useBulkPublishSlots();

  const [pendingBookingId, setPendingBookingId] = useState(null);
  const [pendingUnassignId, setPendingUnassignId] = useState(null);

  // In-app confirm modal + error toast — deliberately not window.confirm()/alert().
  // Several mobile in-app browsers (WhatsApp, Instagram, LinkedIn webviews) silently
  // suppress native JS dialogs, so a mentor opening this dashboard from a shared
  // link inside one of those would tap Unassign/Delete and see nothing happen at
  // all, with no error and no visible failure. { title, message, confirmLabel,
  // danger, pending, error, onConfirm } — populated per action, cleared on close.
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Bulk slot selection (Open Slots list)
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [bulkLinkValue, setBulkLinkValue] = useState("");
  const [bulkLinkEditing, setBulkLinkEditing] = useState(false);

  // Allocate-by-PGP-ID sheet (per open slot)
  const [allocateSlotTarget, setAllocateSlotTarget] = useState(null);

  // Reassign / Swap sheets (per participant booking — both sheets already operate
  // on a single { bookingId, student, date, time, endTime } shape, not a slot, so
  // GD/CASE slots with multiple participants just contribute one candidate per seat)
  const [reassignTarget, setReassignTarget] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const allBookedParticipants = [...ongoingSessions, ...bookedSessions].flatMap((s) =>
    (s.participants ?? []).map((p) => ({
      bookingId: p.bookingId,
      student: { name: p.name, pgp: p.pgp },
      date: s.date,
      time: s.time,
      endTime: s.endTime,
      slotType: s.slotType,
      role: p.role ?? null,
    })),
  );
  // Server rejects a swap across slot types, and for CASE across roles (it'd
  // desync SlotCapacity.solverClaimed / risk two Solvers in one slot — see
  // swapBookings) — filtered out here too so the picker never offers a choice
  // that would just come back as an error.
  const swapCandidates = allBookedParticipants.filter(
    (c) =>
      c.bookingId !== swapTarget?.bookingId &&
      new Date(c.endTime) > new Date() &&
      (!swapTarget || (
        c.slotType === swapTarget.slotType &&
        (swapTarget.slotType !== "CASE" || c.role === swapTarget.role)
      )),
  );

  const handleAttendance = (bookingId, status) => {
    setPendingBookingId(bookingId);
    attendanceMutation.mutate(
      { bookingId, status },
      {
        onSuccess: () => setPendingBookingId(null),
        onError:   (err) => { setPendingBookingId(null); setActionError(err.message); },
      },
    );
  };

  const handleUnassign = (bookingId, studentName) => {
    setConfirmDialog({
      title: "Unassign student?",
      message: `Unassign ${studentName} from this slot? They'll be notified by email and the slot reopens for anyone to book. No penalty applies.`,
      confirmLabel: "Unassign",
      danger: true,
      onConfirm: () => {
        setPendingUnassignId(bookingId);
        unassignMutation.mutate(bookingId, {
          onSuccess: () => { setPendingUnassignId(null); setConfirmDialog(null); },
          onError:   (err) => { setPendingUnassignId(null); setConfirmDialog(null); setActionError(err.message); },
        });
      },
    });
  };

  const handleDeleteSlot = (slotId, studentName) => {
    setConfirmDialog({
      title: "Delete this slot?",
      message: studentName
        ? `Delete this slot? ${studentName}'s booking will be cancelled and they'll be notified by email. This can't be undone.`
        : "Delete this slot? This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        deleteSlotMutation.mutate(slotId, {
          onSuccess: () => setConfirmDialog(null),
          onError:   (err) => { setConfirmDialog(null); setActionError(err.message); },
        });
      },
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
    setConfirmDialog({
      title: "Delete selected slots?",
      message: `Delete ${selectedSlotIds.length} selected slot${selectedSlotIds.length !== 1 ? "s" : ""}? Slots with existing bookings will be skipped.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        bulkDeleteMutation.mutate(selectedSlotIds, {
          onSuccess: (res) => {
            setConfirmDialog(null);
            clearSelection();
            if (res.skipped?.length > 0) {
              setActionError(`${res.deleted} slot(s) deleted. ${res.skipped.length} skipped (already booked).`);
            }
          },
          onError: (err) => { setConfirmDialog(null); setActionError(err.message); },
        });
      },
    });
  };

  const handleBulkSetLink = () => {
    if (selectedSlotIds.length === 0) return;
    bulkLinkMutation.mutate(
      { slotIds: selectedSlotIds, meetingLink: bulkLinkValue.trim() },
      { onSuccess: clearSelection, onError: (err) => setActionError(err.message) },
    );
  };

  const handleBulkPublish = () => {
    if (selectedSlotIds.length === 0) return;
    bulkPublishMutation.mutate(selectedSlotIds, {
      onSuccess: clearSelection,
      onError: (err) => setActionError(err.message),
    });
  };

  return (
    <div className="min-h-screen-safe app-bg text-emerald-950 font-sans">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen-safe bg-[var(--color-bg)] shadow-2xl relative flex flex-col">

        {/* Header — identity bar only; stays put while the page scrolls beneath it */}
        <header className="sticky top-0 z-30 bg-emerald-900 px-5 header-safe-top pb-4 shadow-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 shrink-0 min-w-0">
            <img src={psLogo} alt="Parthsaarthi" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
            <div className="min-w-0">
              <div className="text-white font-black text-sm leading-tight truncate">Parthsaarthi</div>
              <div className="text-emerald-300/70 text-[10px] font-bold uppercase tracking-widest leading-none mt-0.5 truncate">
                Mentor Console
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AvatarMenu variant="dark" shukracharyaTo="/mentor" />
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

          <HoursReleasedCard />

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
                    key={session.id}
                    session={session}
                    onAttendance={handleAttendance}
                    pendingBookingId={pendingBookingId}
                    onReassign={setReassignTarget}
                    onSwap={setSwapTarget}
                    onDelete={handleDeleteSlot}
                    onUnassign={handleUnassign}
                    pendingUnassignId={pendingUnassignId}
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
                    key={session.id}
                    session={session}
                    onAttendance={handleAttendance}
                    pendingBookingId={pendingBookingId}
                    onReassign={setReassignTarget}
                    onSwap={setSwapTarget}
                    onDelete={handleDeleteSlot}
                    onUnassign={handleUnassign}
                    pendingUnassignId={pendingUnassignId}
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

          {/* History — past sessions already marked Attended / No-Show */}
          <CollapsibleSection
            title="History"
            count={historyCount}
            badgeClassName="bg-slate-200 text-slate-600"
          >
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
              {historyFetching && historySessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
              ) : historySessions.length === 0 ? (
                <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                  No sessions marked Attended or No-Show yet
                </div>
              ) : (
                historySessions.map((session) => (
                  <HistorySessionRow key={session.bookingId} session={session} />
                ))
              )}
            </div>
            {historyCount > 0 && (
              <div className="flex items-center justify-between mt-2 px-1">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1 || historyFetching}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 disabled:text-emerald-900/20 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <span className="text-[11px] font-bold text-emerald-700/60">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPage >= historyTotalPages || historyFetching}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 disabled:text-emerald-900/20 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
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
                        {SLOT_TYPE_LABELS[slot.slotType] && (
                          <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            {SLOT_TYPE_LABELS[slot.slotType]}
                            {MULTI_PARTICIPANT_TYPES.includes(slot.slotType) && ` · ${slot.seatsTaken}/${slot.seatsMax}`}
                          </span>
                        )}
                        {slot.cohortOnly && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Cohort Only</span>
                        )}
                        {slot.published ? (
                          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Published</span>
                        ) : (
                          <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Draft</span>
                        )}
                      </div>
                      <VenueEditor slotId={slot.id} currentVenue={slot.venue} currentLink={slot.meetingLink} />
                      {checkIsOnlineVenue(slot.venue) && (
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
                expiredSlots.map((slot) => (
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
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      disabled={deleteSlotMutation.isPending}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                      title={slot.reason === "Cancelled" ? "Clear this slot (its cancelled booking stays in history)" : "Delete this slot"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          <AllocateSheet slot={allocateSlotTarget} isOpen={!!allocateSlotTarget} onClose={() => setAllocateSlotTarget(null)} />
          <ReassignSheet booking={reassignTarget} isOpen={!!reassignTarget} onClose={() => setReassignTarget(null)} />
          <SwapSheet booking={swapTarget} candidates={swapCandidates} isOpen={!!swapTarget} onClose={() => setSwapTarget(null)} />
          <ConfirmDialog
            isOpen={!!confirmDialog}
            title={confirmDialog?.title}
            message={confirmDialog?.message}
            confirmLabel={confirmDialog?.confirmLabel}
            danger={confirmDialog?.danger}
            pending={unassignMutation.isPending || deleteSlotMutation.isPending || bulkDeleteMutation.isPending}
            onConfirm={() => confirmDialog?.onConfirm()}
            onCancel={() => setConfirmDialog(null)}
          />
          {actionError && (
            <div className="fixed bottom-4 left-4 right-4 z-[110] max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
              <div className="bg-red-600 text-white text-sm font-bold rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
                <span>{actionError}</span>
                <button onClick={() => setActionError(null)} className="shrink-0 text-white/80 hover:text-white" title="Dismiss">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          {slotCreationNotice && (
            <div className="fixed bottom-4 left-4 right-4 z-[110] max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
              <div className="bg-amber-500 text-white text-sm font-bold rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
                <span>{slotCreationNotice}</span>
                <button onClick={() => setSlotCreationNotice(null)} className="shrink-0 text-white/80 hover:text-white" title="Dismiss">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
