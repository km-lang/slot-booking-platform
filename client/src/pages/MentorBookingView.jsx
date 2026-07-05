import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock, MapPin, Video, AlertTriangle, ShieldCheck,
  ChevronDown, XCircle, Phone, MessageCircle, Mail,
} from "lucide-react";
import { useMentor, useSlots, useBookSlot, useCancelBooking, useJoinWaitlist, useLeaveWaitlist } from "../hooks/useApi";
import AppFooter from "../components/AppFooter";
import Sheet from "../components/ui/Sheet";

// Kept consistent with StudentMyBookings.jsx and MentorDashboard.jsx — same
// focus value should read the same wherever it's shown.
const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
};

const fmt = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// wa.me needs digits only (no "+", spaces, or dashes).
const toWhatsAppDigits = (phone) => phone.replace(/[^0-9]/g, "");

// Notification-only — never auto-books. Joining just means: get emailed once if
// this exact slot frees up; still have to come back and book it like anyone else.
function WaitlistButton({ slot, mentorId }) {
  const join = useJoinWaitlist(mentorId);
  const leave = useLeaveWaitlist(mentorId);
  const isPending = join.isPending || leave.isPending;

  if (slot.onWaitlist) {
    return (
      <button
        onClick={() => leave.mutate(slot.id)}
        disabled={isPending}
        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 disabled:opacity-50"
        title="Tap to leave the waitlist"
      >
        {isPending ? "…" : "✓ On Waitlist"}
      </button>
    );
  }
  return (
    <button
      onClick={() => join.mutate(slot.id)}
      disabled={isPending}
      className="text-[10px] font-bold text-emerald-900/50 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Booked — Join Waitlist"}
    </button>
  );
}

export default function MentorBookingView() {
  const { group, mentorId } = useParams();
  const navigate = useNavigate();

  const { data: mentor, isLoading: mentorLoading, error: mentorError } = useMentor(mentorId);
  const { data: slots = [], isLoading: slotsLoading, error: slotsError } = useSlots(mentorId);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sheetMode, setSheetMode] = useState("BOOK");
  const [purpose, setPurpose] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(null);

  const bookMutation    = useBookSlot(mentorId);
  const cancelMutation  = useCancelBooking(mentorId);

  const isProcessing = bookMutation.isPending || cancelMutation.isPending;
  // Normalize "This student" → "You" for student-facing display.
  const rawError     = bookMutation.error?.message ?? cancelMutation.error?.message ?? null;
  const actionError  = rawError?.replace(/^This student('s)?/i, (_, s) => s ? "Your" : "You") ?? null;
  // Any 409 on booking means the user can't book this specific slot right now —
  // show the exact server reason and swap the button to "Choose Another Slot".
  const bookConflict = sheetMode === "BOOK" && bookMutation.error?.status === 409;

  // Reset mutation errors when the sheet closes
  useEffect(() => {
    if (!selectedSlot) {
      bookMutation.reset();
      cancelMutation.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot]);

  const openSheet = (slot, mode) => {
    setSelectedSlot(slot);
    setSheetMode(mode);
    setPurpose("");
    if (mode === "BOOK") setIdempotencyKey(crypto.randomUUID());
  };

  const handleAction = () => {
    if (sheetMode === "BOOK") {
      bookMutation.mutate(
        { slotId: selectedSlot.id, focus: purpose, idempotencyKey },
        // On a 409 (someone else booked it first) we deliberately leave the sheet open —
        // the error message renders below and the slot list behind it has already
        // refreshed (see useBookSlot's onError) to show the slot as taken.
        { onSuccess: () => setSelectedSlot(null) },
      );
    } else {
      // Stay on this mentor's page instead of bouncing to the AIG/mentor list —
      // useCancelBooking's onSuccess already invalidates the slot list and
      // myBookings, so this page's own re-render is enough to reflect the
      // cancellation (the slot reopens right here).
      cancelMutation.mutate(selectedSlot.bookingId, {
        onSuccess: () => setSelectedSlot(null),
      });
    }
  };

  const displayName =
    mentor?.name ??
    mentorId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const loading = mentorLoading || slotsLoading;
  const error   = mentorError || slotsError;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-emerald-800/40 text-sm font-bold">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-sm font-bold text-red-700 text-center">{error.message}</p>
        <button onClick={() => navigate("/student")} className="text-xs font-bold text-emerald-700 underline">
          Back to mentors
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative px-4">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center font-black text-3xl text-emerald-800 border-4 border-[var(--color-bg)] shadow-lg">
            {displayName.split(" ").map((n) => n[0]).join("").substring(0, 2)}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-2 border-[var(--color-bg)] flex items-center justify-center animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-emerald-950 leading-tight">{displayName}</h2>
        {mentor?.firm && (
          <p className="text-xs font-bold text-emerald-700/70 mt-1">
            {mentor.firm} · {mentor.domain}
          </p>
        )}
        <p className="text-[10px] font-bold text-emerald-700/40 uppercase tracking-widest mt-1">
          {group === "none" ? "Non-AIG Mentor" : `${group.toUpperCase()} MENTOR`}
        </p>
      </div>

      {/* Slots List */}
      <div className="pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <h3 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
          Available Sessions
        </h3>
        <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
          {slots.length === 0 ? (
            <div className="p-8 text-center text-emerald-800/40 text-sm font-semibold">
              No upcoming slots available
            </div>
          ) : (
            slots.map((slot) => {
              const isMine      = slot.status === "BOOKED_BY_ME";
              const isAvailable = slot.status === "AVAILABLE";
              const slotTime    = `${fmt(slot.startTime)} – ${fmt(slot.endTime)}`;

              return (
                <div
                  key={slot.id}
                  className={`w-full p-4 flex items-center justify-between gap-4 transition-colors relative
                    ${isMine ? "bg-emerald-50/50" : !isAvailable ? "bg-slate-50/50 opacity-60" : "hover:bg-emerald-50/30"}`}
                >
                  {isMine && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                  <div className="flex-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 mb-0.5">
                      {fmtDate(slot.startTime)}
                    </div>
                    <div className={`font-bold text-[16px] mb-1 ${isMine ? "text-emerald-700" : "text-emerald-950"}`}>
                      {slotTime}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-800/60">
                      <span className="flex items-center gap-1">
                        {slot.venue.toLowerCase().includes("online") ? <Video size={12} /> : <MapPin size={12} />}
                        {slot.venue}
                      </span>
                      {slot.cohortOnly && (
                        <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                          Cohort Only
                        </span>
                      )}
                      {isMine && slot.focus && (
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] uppercase">
                          {FOCUS_LABELS[slot.focus] ?? slot.focus}
                        </span>
                      )}
                      {isMine && slot.delayMinutes > 0 && (
                        <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                          <Clock size={9} /> Running {slot.delayMinutes}m late
                        </span>
                      )}
                    </div>
                    {isMine && slot.meetingLink && (
                      <a
                        href={slot.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
                      >
                        <Video size={10} /> Join Google Meet
                      </a>
                    )}
                    {isMine && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {slot.mentorPhone ? (
                          <>
                            <a
                              href={`tel:${slot.mentorPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
                            >
                              <Phone size={10} /> Call
                            </a>
                            <a
                              href={`https://wa.me/${toWhatsAppDigits(slot.mentorPhone)}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
                            >
                              <MessageCircle size={10} /> WhatsApp
                            </a>
                          </>
                        ) : slot.mentorEmail && (
                          <a
                            href={`mailto:${slot.mentorEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
                          >
                            <Mail size={10} /> Email Mentor
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isAvailable && (
                      <button
                        onClick={() => openSheet(slot, "BOOK")}
                        className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-4 py-2 rounded-xl transition-colors"
                      >
                        Book
                      </button>
                    )}
                    {isMine && (
                      <button onClick={() => openSheet(slot, "CANCEL")} className="flex flex-col items-end gap-1 group">
                        <span className="text-xs font-bold text-red-600 bg-red-50 group-hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                          Cancel Session <XCircle size={12} />
                        </span>
                      </button>
                    )}
                    {slot.status === "BOOKED_BY_OTHER" && (
                      <WaitlistButton slot={slot} mentorId={mentorId} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pb-safe">
        <AppFooter />
      </div>

      {/* Bottom Sheet — width-clamped to match StudentLayout's shell so it
          doesn't span the full browser window on desktop. */}
      <Sheet isOpen={!!selectedSlot} onClose={() => !isProcessing && setSelectedSlot(null)}>
        {selectedSlot && (() => {
          const slotTime = `${fmtDate(selectedSlot.startTime)}, ${fmt(selectedSlot.startTime)} – ${fmt(selectedSlot.endTime)}`;

          return (
            <div>
              <h3 className="text-xl font-black text-emerald-950 mb-1">
                {sheetMode === "BOOK" ? "Confirm Session" : "Cancel Session"}
              </h3>
              <p className="text-sm font-semibold text-emerald-700/70 mb-6">with {displayName}</p>

              <div className={`border rounded-2xl p-4 mb-6 ${sheetMode === "BOOK" ? "bg-[var(--color-bg)] border-emerald-900/10" : "bg-red-50/50 border-red-100"}`}>
                <div className={`flex items-center gap-3 mb-3 pb-3 border-b ${sheetMode === "BOOK" ? "border-emerald-900/5" : "border-red-900/5"}`}>
                  <Clock className={sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"} size={18} />
                  <span className="font-bold text-emerald-950">{slotTime}</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedSlot.venue?.toLowerCase().includes("online")
                    ? <Video className={sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"} size={18} />
                    : <MapPin className={sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"} size={18} />}
                  <span className="font-semibold text-emerald-800/80">{selectedSlot.venue}</span>
                </div>
              </div>

              {sheetMode === "BOOK" && (
                <>
                  <div className="mb-6">
                    <label className="block text-[11px] font-bold text-emerald-800/60 uppercase tracking-widest mb-2">
                      Session Focus (Required)
                    </label>
                    <div className="relative">
                      <select
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 shadow-sm appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select your focus…</option>
                        {Object.entries(FOCUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-3 text-emerald-900/30 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl mb-6">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-red-900/80 leading-tight">
                      No-shows result in an automatic strike. You can cancel any time with no automatic penalty.
                    </p>
                  </div>
                </>
              )}

              {sheetMode === "CANCEL" && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-6 border bg-amber-50 border-amber-200">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <p className="text-[11px] font-bold leading-tight text-amber-900/80">
                    Cancelling won't automatically affect your record. Your mentor will be notified, and may apply a strike for last-minute or repeated cancellations.
                  </p>
                </div>
              )}

              {actionError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-700">
                    {actionError}
                  </p>
                </div>
              )}

              <button
                disabled={bookConflict ? false : (sheetMode === "BOOK" && !purpose) || isProcessing}
                onClick={bookConflict ? () => setSelectedSlot(null) : handleAction}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200
                  ${bookConflict
                    ? "bg-emerald-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] active:scale-95"
                    : isProcessing || (sheetMode === "BOOK" && !purpose)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : sheetMode === "BOOK"
                    ? "bg-emerald-900 text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] active:scale-95"
                    : "bg-red-600 text-white shadow-[0_8px_20px_rgba(220,38,38,0.2)] active:scale-95"}`}
              >
                {isProcessing ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : bookConflict ? (
                  "Choose Another Slot"
                ) : (
                  <>
                    {sheetMode === "BOOK" ? <ShieldCheck size={18} /> : <XCircle size={18} />}
                    {sheetMode === "BOOK" ? "Lock In Booking" : "Confirm Cancellation"}
                  </>
                )}
              </button>

              {!bookConflict && (
                <button
                  disabled={isProcessing}
                  onClick={() => setSelectedSlot(null)}
                  className="w-full py-3 mt-2 text-sm font-bold text-emerald-800/60 hover:text-emerald-950 transition-colors"
                >
                  {sheetMode === "BOOK" ? "Not Now" : "Keep My Booking"}
                </button>
              )}
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
