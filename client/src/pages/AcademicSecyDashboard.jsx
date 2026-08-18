import React, { useMemo, useState } from "react";
import { Building2, Shield, ChevronDown, Filter, X } from "lucide-react";
import { useSecyMentorActivity } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import Card from "../components/ui/Card";
import psLogo from "../assets/PSLogo.png";

const SLOT_TYPES = ["CV", "GD", "CASE", "STOCK_PITCH"];
const SLOT_TYPE_LABEL = { CV: "CV", GD: "GD", CASE: "Case", STOCK_PITCH: "Stock Pitch" };

function MentorRow({ mentor }) {
  return (
    <tr className="border-b border-emerald-900/5 hover:bg-emerald-50/30">
      <td className="py-2.5 px-4 font-semibold text-emerald-950">{mentor.name}</td>
      {SLOT_TYPES.map((t) => (
        <td key={t} className="py-2.5 px-4 text-center text-xs">
          <div className="font-bold text-emerald-950">{mentor.byType[t].count}</div>
          <div className="text-emerald-700/50">{mentor.byType[t].hours}h</div>
        </td>
      ))}
      <td className="py-2.5 px-4 text-center font-bold text-emerald-900">{mentor.totalCount}</td>
      <td className="py-2.5 px-4 text-center font-bold text-emerald-900">{mentor.totalHours}h</td>
    </tr>
  );
}

function GroupSection({ group, mentors, isExpanded, onToggle }) {
  const groupTotals = useMemo(
    () => mentors.reduce((acc, m) => ({ count: acc.count + m.totalCount, hours: acc.hours + m.totalHours }), { count: 0, hours: 0 }),
    [mentors],
  );

  return (
    <Card padding="p-0" className="overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full p-4 flex items-center gap-3 transition-colors ${isExpanded ? "bg-emerald-50/50" : "hover:bg-emerald-50/30"}`}
      >
        {group.category === "COMMITTEE" ? (
          <Shield size={16} className="text-emerald-700 shrink-0" />
        ) : (
          <Building2 size={16} className="text-emerald-700 shrink-0" />
        )}
        <span className="font-bold text-sm text-emerald-950 flex-1 text-left">{group.name}</span>
        <span className="text-xs font-bold text-emerald-700/50 whitespace-nowrap">
          {mentors.length} mentor{mentors.length !== 1 ? "s" : ""} · {groupTotals.count} slots · {+groupTotals.hours.toFixed(1)}h
        </span>
        <ChevronDown size={16} className={`text-emerald-900/40 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded && (
        <div className="border-t border-emerald-900/5 overflow-x-auto">
          {mentors.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-emerald-800/30">No members</div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-emerald-900/10 text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
                  <th className="py-2 px-4">Mentor</th>
                  {SLOT_TYPES.map((t) => (
                    <th key={t} className="py-2 px-4 text-center">{SLOT_TYPE_LABEL[t]}</th>
                  ))}
                  <th className="py-2 px-4 text-center">Total Slots</th>
                  <th className="py-2 px-4 text-center">Total Hours</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {mentors.map((m) => <MentorRow key={m.mentorId} mentor={m} />)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

// Read-only, cross-group view for the Academic Secretary — deliberately built
// as its own page rather than reusing PlacementAdminDashboard, since every
// tab there is ultimately keyed off individual students (PGP/ABM rosters,
// names, emails), which this role must never see. Scope is exactly: the list
// of AIG/Disha/Crack Tank groups, their mentor members, and those mentors'
// slot hours/counts by type — optionally windowed by session date.
export default function AcademicSecyDashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState(null);

  const rangeReady = !!from && !!to;
  const { data, isLoading, error } = useSecyMentorActivity(rangeReady ? from : undefined, rangeReady ? to : undefined);

  const groups = data?.groups ?? [];

  const mentorsByGroup = useMemo(() => {
    const map = {};
    for (const g of data?.groups ?? []) map[g.slug] = [];
    for (const m of data?.mentors ?? []) {
      if (!map[m.groupSlug]) map[m.groupSlug] = [];
      map[m.groupSlug].push(m);
    }
    return map;
  }, [data]);

  const clearFilter = () => { setFrom(""); setTo(""); };

  return (
    <div className="min-h-screen app-bg text-emerald-950 font-sans pb-12">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex justify-between items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950 min-w-0">
          <img src={psLogo} alt="Parthsaarthi" className="w-8 h-8 rounded-lg object-contain bg-white shrink-0" />
          <div className="truncate leading-tight">
            <div className="truncate">Parthsaarthi</div>
            <div className="hidden sm:block text-emerald-700 text-[10px] font-bold uppercase tracking-widest truncate">
              Academic Secretary · Mentoring Activity
            </div>
          </div>
        </div>
        <AvatarMenu />
      </nav>

      <header className="bg-white border-b border-emerald-900/10 px-6 py-5">
        <h1 className="text-2xl font-black text-emerald-950">AIG / Disha / Crack Tank Mentoring Activity</h1>
        <p className="text-sm font-semibold text-emerald-700/70">Slots taken by mentors, by type — for CV-point verification</p>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-4">
        <Card>
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-emerald-800/60 uppercase tracking-widest">
            <Filter size={14} /> Date Range
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-emerald-700/70">
              From
              <input
                type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-emerald-700/70">
              To
              <input
                type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="bg-[var(--color-bg)] border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500"
              />
            </label>
            {(from || to) && (
              <button onClick={clearFilter} className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 px-3 py-2">
                <X size={14} /> Clear (show all-time)
              </button>
            )}
          </div>
          {(from && !to) || (!from && to) ? (
            <p className="text-xs font-bold text-amber-600 mt-2">Pick both a From and To date to apply the filter.</p>
          ) : null}
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
            {error.message}
          </div>
        )}

        <div className="space-y-3 pb-8">
          {isLoading ? (
            <Card><div className="text-xs font-bold text-emerald-800/30 text-center py-8">Loading…</div></Card>
          ) : groups.length === 0 ? (
            <Card><div className="text-xs font-bold text-emerald-800/30 text-center py-8">No groups found</div></Card>
          ) : (
            groups.map((g) => (
              <GroupSection
                key={g.slug}
                group={g}
                mentors={mentorsByGroup[g.slug] ?? []}
                isExpanded={expanded === g.slug}
                onToggle={() => setExpanded((e) => (e === g.slug ? null : g.slug))}
              />
            ))
          )}
        </div>
        <AppFooter />
      </main>
    </div>
  );
}
