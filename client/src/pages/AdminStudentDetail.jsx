import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CalendarCheck, CheckCircle, XCircle, AlertCircle, Ban, Flag } from "lucide-react";
import { useStudentDetail, useRemoveStrike } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ConfirmDialog from "../components/ui/ConfirmDialog";

// No-Show is red (worse — feeds an automatic strike) and Cancelled is amber
// (milder — proactive, mentor-reviewed only), consistent with every other
// status badge in the app (see StudentMyBookings.jsx's STATUS_CONFIG).
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
  const removeStrikeMutation = useRemoveStrike();

  // In-app confirm modal — deliberately not window.confirm()/alert(), same as
  // PlacementAdminDashboard's BansTab.
  const [pendingRemove, setPendingRemove] = useState(null); // { id, reason }
  const confirmRemoveStrike = () => {
    removeStrikeMutation.mutate(
      { id: pendingRemove.id, pgpId },
      { onSuccess: () => setPendingRemove(null) },
    );
  };

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

  const { student, stats, bookingHistory = [], bans = [], warnings = [] } = data;
  const activeBan = bans.find((b) => !b.liftedAt && (!b.endsAt || new Date(b.endsAt) > new Date()));

  const fmtWarningDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <AppShell
      maxWidthClassName="max-w-4xl"
      header={
        <PageHeader
          title={student.name}
          subtitle={`${student.pgpId} · ${student.cohortLabel ?? "No Cohort"}${student.orgName ? ` · ${student.orgName}` : ""}`}
          onBack={() => navigate("/admin/placements")}
          actions={<AvatarMenu />}
        />
      }
    >
      <main className="px-4 py-6 space-y-8">
        <Card className="flex flex-wrap gap-4 items-start">
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
        </Card>

        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={CalendarCheck} label="Total Bookings" value={stats.totalBookings} color="slate"  />
            <StatCard icon={CheckCircle}   label="Attended"       value={stats.attended}      color="emerald" />
            <StatCard icon={XCircle}       label="No-Show"        value={stats.noShow}        color="red"     />
            <StatCard icon={AlertCircle}   label="Cancelled"      value={stats.cancelled}     color="amber"   />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Strikes</h3>
          {warnings.length === 0 ? (
            <Card padding="p-8" className="text-center text-slate-400 text-sm">
              No strikes
            </Card>
          ) : (
            <Card padding="p-0" className="overflow-hidden divide-y divide-emerald-900/5">
              {warnings.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Flag size={10} /> {w.type}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700/50">{fmtWarningDate(w.createdAt)}</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-950">{w.reason}</p>
                    {w.issuedBy && <p className="text-xs text-slate-400 mt-0.5">Issued by {w.issuedBy}</p>}
                  </div>
                  <button
                    onClick={() => setPendingRemove({ id: w.id, reason: w.reason })}
                    disabled={removeStrikeMutation.isPending}
                    className="ml-4 px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-40 shrink-0"
                  >
                    Remove Strike
                  </button>
                </div>
              ))}
            </Card>
          )}
        </section>

        <section>
          <h3 className="text-xs font-bold text-emerald-900/50 uppercase tracking-widest mb-3">Booking History</h3>
          {bookingHistory.length === 0 ? (
            <Card padding="p-8" className="text-center text-slate-400 text-sm">
              No sessions yet
            </Card>
          ) : (
            <Card padding="p-0" className="overflow-x-auto">
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
            </Card>
          )}
        </section>
        <AppFooter />
      </main>
      <ConfirmDialog
        isOpen={!!pendingRemove}
        title="Remove this strike?"
        message={`Remove the "${pendingRemove?.reason}" strike from ${student.name}'s record? This deletes it permanently from the database.`}
        confirmLabel="Remove Strike"
        danger
        pending={removeStrikeMutation.isPending}
        error={removeStrikeMutation.error?.message}
        onConfirm={confirmRemoveStrike}
        onCancel={() => setPendingRemove(null)}
      />
    </AppShell>
  );
}
