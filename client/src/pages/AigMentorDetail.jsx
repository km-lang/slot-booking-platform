import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle, XCircle, Clock, AlertTriangle, Users } from "lucide-react";
import { useMentorDetail } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";

const STATUS_BADGE = {
  CONFIRMED: { label: "Confirmed", cls: "bg-blue-100 text-blue-700" },
  ATTENDED:  { label: "Attended",  cls: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
  NO_SHOW:   { label: "No-Show",   cls: "bg-amber-100 text-amber-700" },
};

const STUDENT_STATUS = {
  Attended: { label: "Reviewed", cls: "bg-emerald-100 text-emerald-700" },
  Booked:   { label: "Booked",   cls: "bg-blue-100 text-blue-700" },
  Pending:  { label: "Pending",  cls: "bg-slate-100 text-slate-500" },
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

export default function AigMentorDetail() {
  const { aigSlug, mentorSlug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMentorDetail(mentorSlug);

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
        <p className="text-slate-500">Could not load mentor data.</p>
        <button onClick={() => navigate(-1)} className="text-emerald-700 font-semibold underline text-sm">Go back</button>
      </div>
    );
  }

  const { mentor, aig, cohortLabel, stats, students = [], sessionHistory = [] } = data;

  return (
    <div className="min-h-screen app-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-emerald-900/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/${aigSlug}`)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-emerald-50 transition-colors"
          >
            <ArrowLeft size={18} className="text-emerald-800" />
          </button>
          <div>
            <div className="font-black text-emerald-950 text-sm leading-tight">{mentor.name}</div>
            <div className="text-[11px] text-emerald-700/60 font-semibold">
              {aig?.name ?? aigSlug} · {cohortLabel ?? "No Cohort"}
            </div>
          </div>
        </div>
        <AvatarMenu />
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Mentor bio strip */}
        <section className="bg-white border border-emerald-900/10 rounded-2xl p-5 flex flex-wrap gap-4 items-start shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-black text-xl border-2 border-emerald-200 shrink-0">
            {mentor.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-emerald-950 text-lg">{mentor.name}</h2>
            <p className="text-sm text-emerald-700/70">{mentor.firm} · {mentor.domain}</p>
            <p className="text-xs text-slate-400 mt-0.5">{mentor.email}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {cohortLabel && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                {cohortLabel}
              </span>
            )}
          </div>
        </section>

        {/* Stats */}
        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={BookOpen}      label="Slots"      value={stats.totalSlots} color="slate"   />
            <StatCard icon={Clock}         label="Confirmed"  value={stats.confirmed}  color="blue"    />
            <StatCard icon={CheckCircle}   label="Attended"   value={stats.attended}   color="emerald" />
            <StatCard icon={AlertTriangle} label="No-Show"    value={stats.noShow}     color="amber"   />
            <StatCard icon={XCircle}       label="Cancelled"  value={stats.cancelled}  color="red"     />
          </div>
        </section>

        {/* Cohort student list */}
        {students.length > 0 && (
          <section>
            <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Users size={14} /> Cohort Students ({students.length})
            </h3>
            <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-900/8">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Name</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">PGP ID</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Email</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const badge = STUDENT_STATUS[s.status] ?? STUDENT_STATUS.Pending;
                    return (
                      <tr key={i} className="border-b border-emerald-900/5 last:border-0 hover:bg-emerald-50/40">
                        <td className="px-4 py-2.5 font-semibold text-emerald-950">{s.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{s.pgpId}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{s.email}</td>
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
          </section>
        )}

        {/* Session history */}
        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Session History</h3>
          {sessionHistory.length === 0 ? (
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
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Student</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">PGP</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Focus</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-emerald-900/50 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionHistory.map((s) => {
                    const badge = STATUS_BADGE[s.status] ?? { label: s.status, cls: "bg-slate-100 text-slate-500" };
                    return (
                      <tr key={s.id} className="border-b border-emerald-900/5 last:border-0 hover:bg-emerald-50/30">
                        <td className="px-4 py-2.5 text-slate-700 text-xs whitespace-nowrap">{s.date}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">{s.time}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-950">{s.studentName}</td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{s.studentPgp}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{s.focus}</td>
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
