import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, CalendarCheck, Clock, MapPin, CheckCircle2,
  XCircle, AlertCircle, Hourglass, AlertTriangle,
} from "lucide-react";
import { useMyBookings, useCancelBooking } from "../hooks/useApi";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
};

const STATUS_CONFIG = {
  CONFIRMED: {
    label: "Confirmed",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CalendarCheck size={10} />,
  },
  ATTENDED: {
    label: "Attended",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <CheckCircle2 size={10} />,
  },
  NO_SHOW: {
    label: "No Show",
    classes: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle size={10} />,
  },
  CANCELLED: {
    label: "Cancelled",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <AlertCircle size={10} />,
  },
};

function BookingCard({ booking, onCancel, isCancelling }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.CONFIRMED;
  const canCancel = booking.status === "CONFIRMED";
  const initials = booking.mentorName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="bg-white border border-emerald-900/10 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-[15px] text-emerald-950 leading-tight truncate">
              {booking.mentorName}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${cfg.classes}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5 truncate">
            {booking.firm}{booking.domain ? ` · ${booking.domain}` : ""}
          </p>
        </div>
      </div>

      {canCancel && booking.delayMinutes > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-800">
            Running {booking.delayMinutes} min late
          </p>
        </div>
      )}

      <div className="bg-[#F8FAF7] rounded-xl p-3 space-y-1.5 mb-3 border border-emerald-900/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <Clock size={13} className="text-emerald-600 shrink-0" />
          {booking.slotLabel}
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <MapPin size={13} className="text-emerald-600 shrink-0" />
          {booking.venue}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
          <CalendarCheck size={12} className="shrink-0" />
          {FOCUS_LABELS[booking.focus] ?? booking.focus}
        </div>
      </div>

      {canCancel && (
        <button
          onClick={() => onCancel(booking.id)}
          disabled={isCancelling}
          className="w-full py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-bold transition-colors disabled:opacity-50 active:scale-95"
        >
          {isCancelling ? "Cancelling…" : "Cancel Booking"}
        </button>
      )}
    </div>
  );
}

export default function StudentMyBookings() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMyBookings();
  const cancelMutation = useCancelBooking(null);

  const upcoming = data?.upcoming ?? [];
  const past     = data?.past     ?? [];

  const handleCancel = (bookingId) => {
    if (!confirm("Cancel this booking? A penalty may apply if the slot starts soon.")) return;
    cancelMutation.mutate(bookingId, {
      onError: (err) => alert(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl flex flex-col">

        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/student")}
            className="p-2 -ml-2 rounded-full hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-lg leading-tight text-emerald-950">My Sessions</h1>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
              {isLoading
                ? "Loading…"
                : `${upcoming.length} upcoming · ${past.length} past`}
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
              {error.message}
            </div>
          )}

          {/* Upcoming */}
          <section>
            <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
              <Hourglass size={12} /> Upcoming
            </h2>
            {isLoading ? (
              <div className="bg-white border border-emerald-900/10 rounded-2xl p-8 text-center text-xs font-bold text-emerald-800/30">
                Loading…
              </div>
            ) : upcoming.length === 0 ? (
              <div className="bg-white border border-emerald-900/10 rounded-2xl p-8 text-center">
                <CalendarCheck size={32} className="text-emerald-200 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-800/40">No upcoming sessions</p>
                <p className="text-xs font-semibold text-emerald-700/40 mt-1">
                  Book a slot from the mentor list
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancel}
                    isCancelling={cancelMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          <section className="pb-8">
            <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
              <CheckCircle2 size={12} /> History
            </h2>
            {isLoading ? (
              <div className="bg-white border border-emerald-900/10 rounded-2xl p-8 text-center text-xs font-bold text-emerald-800/30">
                Loading…
              </div>
            ) : past.length === 0 ? (
              <div className="bg-white border border-emerald-900/10 rounded-2xl p-6 text-center text-xs font-bold text-emerald-800/30">
                No past sessions yet
              </div>
            ) : (
              <div className="space-y-3">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onCancel={handleCancel}
                    isCancelling={cancelMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
