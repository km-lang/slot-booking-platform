import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarCheck, CheckCircle, XCircle, AlertTriangle, Ban } from "lucide-react";
import { useStudentDetail } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";

const STATUS_BADGE = {
  CONFIRMED: { label: "Confirmed", cls: "bg-blue-100 text-blue-700" },
  ATTENDED:  { label: "Attended",  cls: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-amber-100 text-amber-700" },
  NO_SHOW:   { label: "No-Show",   cls: "bg-red-100 text-red-700" },
};

function StatCard({ icon: Icon, label, value, color = "emerald" }) {
  const colors = {
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    blue:    "bg-blue-50 border-blue-100 text-blue-700",
    red:     "bg-red-50 border-red-100 text-red-700",
    amber:   "bg-amber-50 border-amber-100 text-amber-700",
    slate:   "bg-slate-50 border-slate-200 text-slate-600",
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <Icon size={18} className="mb-2 opacity-70" />
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-semibold opacity-70 uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

export default function AdminStudentDetail() {
  const { pgpId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useStudentDetail(pgpId);

  if (isLoading) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-300 border-t-emerald-700 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen app-bg flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Could not load student data.</p>
        <button onClick={() => navigate(-1)} className="text-emerald-700 font-semibold underline text-sm">Go back</button>
      </div>
    );
  }

  const { student, stats, bookingHistory = [], bans = [] } = data;
  const activeBan = bans.find((b) => !b.liftedAt && (!b.endsAt || new Date(b.endsAt) > new Date()));

  return (
    <div className="min-h-screen app-bg">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-emerald-900/10 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/admin/placements")}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-50 transition-colors shrink-0"
          >
            <ArrowLeft size={18} className="text-emerald-800" />
          </button>
          <div className="min-w-0">
            <div className="font-black text-emerald-950 text-sm leading-tight truncate">{student.name}</div>
            <div className="text-[11px] text-emerald-700/60 font-semibold truncate">
              {student.pgpId} · {student.cohortLabel ?? "No Cohort"} {student.orgName ? `· ${student.orgName}` : ""}
            </div>
          </div>
        </div>
        <AvatarMenu />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <section className="bg-white border border-emerald-900/10 rounded-2xl p-5 flex flex-wrap gap-4 items-start shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-black text-xl border-2 border-emerald-200 shrink-0">
            {student.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-emerald-950 text-lg">{student.name}</h2>
            <p className="text-sm text-emerald-700/70">{student.email}</p>
            <p className="text-xs text-slate-400 mt-0.5">{student.pgpId}</p>
          </div>
          {activeBan && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Ban size={12} /> Banned: {activeBan.reason}
            </span>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={CalendarCheck} label="Total Bookings" value={stats.totalBookings} color="slate"  />
            <StatCard icon={CheckCircle}   label="Attended"       value={stats.attended}      color="emerald" />
            <StatCard icon={AlertTriangle} label="No-Show"        value={stats.noShow}        color="amber"   />
            <StatCard icon={XCircle}       label="Cancelled"      value={stats.cancelled}     color="red"     />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Booking History</h3>
          {bookingHistory.length === 0 ? (
            <div className="bg-white border border-emerald-900/10 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-sm">
              No sessions yet
            </div>
          ) : (
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-emerald-900/8">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Date</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Time</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Mentor</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Venue</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Focus</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingHistory.map((b) => {
                    const badge = STATUS_BADGE[b.status] ?? { label: b.status, cls: "bg-slate-100 text-slate-500" };
                    return (
                      <tr key={b.id} className="border-b border-emerald-900/5 last:border-0 hover:bg-emerald-50/30">
                        <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap">{b.date}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{b.time}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-950">{b.mentorName}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{b.venue}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{b.focus}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <AppFooter />
      </main>
    </div>
  );
}
