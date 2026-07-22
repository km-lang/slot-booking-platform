import React, { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarCheck, Clock, MapPin, CheckCircle,
  XCircle, AlertCircle, AlertTriangle, Download, Video, Loader2,
  Phone, MessageCircle, Mail,
} from "lucide-react";
import { useMyBookings, useExportCsv } from "../hooks/useApi";
import AppFooter from "../components/AppFooter";
import CollapsibleSection from "../components/CollapsibleSection";
import Card from "../components/ui/Card";
import { SkeletonCard } from "../components/ui/Skeleton";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex:  "Work Experience",
  por:     "POR / ECA",
  cv_hr:   "CV-HR",
};

// wa.me needs digits only (no "+", spaces, or dashes).
const toWhatsAppDigits = (phone) => phone.replace(/[^0-9]/g, "");

// Only STUDENT is reachable today (no mentor-cancel path exists in this app),
// but keying off the server's cancelledBy value keeps this correct without
// further client changes if that ever changes.
const CANCELLED_BY_LABEL = {
  STUDENT: "Cancelled by you",
  MENTOR:  "Cancelled by mentor",
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
    icon: <CheckCircle size={10} />,
  },
  NO_SHOW: {
    label: "No-Show",
    classes: "bg-red-100 text-red-700 border-red-200",
    icon: <XCircle size={10} />,
  },
  CANCELLED: {
    label: "Cancelled",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <AlertCircle size={10} />,
  },
};

function BookingCard({ booking }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.CONFIRMED;
  const isUpcomingConfirmed = booking.status === "CONFIRMED" && new Date(booking.slotStart) > new Date();
  const initials = booking.mentorName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card padding="p-4">
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
          {booking.status === "CANCELLED" && booking.cancelledBy && (
            <p className="text-[10px] font-bold text-amber-700/70 mt-0.5">
              {CANCELLED_BY_LABEL[booking.cancelledBy] ?? "Cancelled"}
            </p>
          )}
        </div>
      </div>

      {isUpcomingConfirmed && booking.delayMinutes > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-800">
            Running {booking.delayMinutes} min late
          </p>
        </div>
      )}

      <div className="bg-[var(--color-bg)] rounded-xl p-3 space-y-1.5 mb-3 border border-emerald-900/5">
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

      {booking.status === "CONFIRMED" && booking.meetingLink && (
        <a
          href={booking.meetingLink}
          target="_blank"
          rel="noreferrer"
          className="w-full mb-3 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Video size={13} /> Join Google Meet
        </a>
      )}

      {booking.status === "CONFIRMED" && (booking.mentorPhone || booking.mentorEmail) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {booking.mentorPhone ? (
            <>
              <a
                href={`tel:${booking.mentorPhone}`}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
              >
                <Phone size={10} /> Call
              </a>
              <a
                href={`https://wa.me/${toWhatsAppDigits(booking.mentorPhone)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
              >
                <MessageCircle size={10} /> WhatsApp
              </a>
            </>
          ) : booking.mentorEmail && (
            <a
              href={`mailto:${booking.mentorEmail}`}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
            >
              <Mail size={10} /> Email Mentor
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

export default function StudentMyBookings() {
  const { setHeaderExtra } = useOutletContext();
  const { data, isLoading, error } = useMyBookings();
  const exportMutation = useExportCsv();

  const ongoing  = data?.ongoing  ?? [];
  const upcoming = data?.upcoming ?? [];
  const past     = data?.past     ?? [];

  const handleExport = () => {
    exportMutation.mutate(
      { path: "/bookings/export", filename: "my-bookings.csv" },
      { onSettled: () => setTimeout(() => exportMutation.reset(), 2500) },
    );
  };

  // Pushes this page's dynamic subtitle (booking counts) and export button up
  // into StudentLayout's shared sticky header — the layout itself has no idea
  // what a booking count or an export button is, it just renders whatever the
  // active nested route hands it.
  useEffect(() => {
    setHeaderExtra({
      subtitle: isLoading
        ? "Loading…"
        : `${ongoing.length} ongoing · ${upcoming.length} upcoming · ${past.length} past`,
      actions: (
        <button
          onClick={handleExport}
          disabled={exportMutation.isPending || isLoading || (upcoming.length === 0 && past.length === 0)}
          className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40"
          title={
            exportMutation.isPending ? "Exporting…"
            : exportMutation.isSuccess ? "Downloaded"
            : exportMutation.isError ? (exportMutation.error?.message ?? "Export failed")
            : "Export my booking history (CSV)"
          }
        >
          {exportMutation.isPending ? <Loader2 size={18} className="animate-spin" />
            : exportMutation.isSuccess ? <CheckCircle size={18} className="text-emerald-600" />
            : exportMutation.isError ? <XCircle size={18} className="text-red-600" />
            : <Download size={18} />}
        </button>
      ),
    });
    return () => setHeaderExtra({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, ongoing.length, upcoming.length, past.length, exportMutation.isPending, exportMutation.isSuccess, exportMutation.isError]);

  return (
    <>
      <main className="flex-1 px-4 py-6 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
            {error.message}
          </div>
        )}

        {/* Ongoing — session has started but the mentor hasn't ended/marked it yet */}
        <CollapsibleSection
          title="Ongoing"
          count={ongoing.length}
          badgeClassName="bg-red-100 text-red-700"
          defaultOpen
        >
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1].map((i) => <SkeletonCard key={i} padding="p-4" />)}
            </div>
          ) : ongoing.length === 0 ? (
            <Card padding="p-8" className="text-center">
              <CalendarCheck size={32} className="text-emerald-200 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-800/40">No ongoing sessions right now</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {ongoing.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Upcoming */}
        <CollapsibleSection
          title="Upcoming"
          count={upcoming.length}
          badgeClassName="bg-emerald-100 text-emerald-700"
          defaultOpen
        >
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1].map((i) => <SkeletonCard key={i} padding="p-4" />)}
            </div>
          ) : upcoming.length === 0 ? (
            <Card padding="p-8" className="text-center">
              <CalendarCheck size={32} className="text-emerald-200 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-800/40">No upcoming sessions</p>
              <p className="text-xs font-semibold text-emerald-700/40 mt-1">
                Book a slot from the mentor list
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Past */}
        <div className="pb-8">
          <CollapsibleSection
            title="History"
            count={past.length}
            badgeClassName="bg-slate-200 text-slate-600"
          >
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[0, 1].map((i) => <SkeletonCard key={i} padding="p-4" />)}
              </div>
            ) : past.length === 0 ? (
              <Card padding="p-6" className="text-center text-xs font-bold text-emerald-800/30">
                No past sessions yet
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </main>
      <div className="pb-safe">
        <AppFooter />
      </div>
    </>
  );
}
