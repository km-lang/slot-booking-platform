import React, { useState, useEffect } from "react";
import {
  Activity, Users, CalendarCheck, Ban, Download, Shield, AlertTriangle,
  ActivitySquare, Lock, List, Settings, Plus, Trash2, Save, ShieldOff, Search,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useAdminBatch, useWhitelist, useAigs, useConfig, useBans,
  useAddWhitelist, useRemoveWhitelist, useSaveConfig, useLiftBan,
} from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import { getToken } from "../lib/apiClient";

const COLORS = ["#000000", "#515151", "#b13b35", "#dfcac8"];

const downloadCsv = async (url, filename) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) return;
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
};

const ACTION_LABEL = {
  BOOKING_CREATED:    "Booking Created",
  BOOKING_CANCELLED:  "Booking Cancelled",
  SLOT_RELEASED:      "Slots Released",
  NO_SHOW_RECORDED:   "No-Show Recorded",
  ATTENDANCE_RECORDED:"Attended",
  BAN_APPLIED:        "Ban Applied",
  BAN_LIFTED:         "Ban Lifted",
};

const ACTION_BADGE = {
  BOOKING_CREATED:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  SLOT_RELEASED:      "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATTENDANCE_RECORDED:"bg-emerald-100 text-emerald-800 border-emerald-200",
  BOOKING_CANCELLED:  "bg-amber-100 text-amber-800 border-amber-200",
  NO_SHOW_RECORDED:   "bg-red-100 text-red-800 border-red-200",
  BAN_APPLIED:        "bg-red-100 text-red-800 border-red-200",
  BAN_LIFTED:         "bg-slate-100 text-slate-700 border-slate-200",
};

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const parseMeta = (action, metaStr) => {
  if (!metaStr) return null;
  try {
    const m = JSON.parse(metaStr);
    if (action === "SLOT_RELEASED"      && m.count)     return `Released ${m.count} slot${m.count !== 1 ? "s" : ""}`;
    if (action === "BOOKING_CANCELLED"  && m.penalty)   return `Penalty: ${m.penalty}`;
    if (action === "BAN_APPLIED"        && m.reason)    return m.reason;
    if (action === "BAN_LIFTED"         && m.liftedBy)  return `Lifted by ${m.liftedBy}`;
    if (action === "NO_SHOW_RECORDED"   && m.slotId)    return `Slot ${String(m.slotId).slice(-6)}`;
    return null;
  } catch { return null; }
};

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",  icon: <ActivitySquare size={14} /> },
  { id: "whitelist", label: "Whitelist", icon: <List size={14} /> },
  { id: "config",    label: "Config",    icon: <Settings size={14} /> },
  { id: "bans",      label: "Bans",      icon: <ShieldOff size={14} /> },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading, error } = useAdminBatch();

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
        {error.message}
      </div>
    );
  }

  const { kpis = {}, purposeDistribution = [], mentorUtilization = [], recentAuditEvents = [] } = data ?? {};

  const kpiCards = [
    {
      label: "Batch Coverage",
      value: isLoading ? "—" : `${kpis.batchCoverage?.pct ?? 0}%`,
      sub:   isLoading ? "Loading…" : `${kpis.batchCoverage?.covered ?? 0} / ${kpis.batchCoverage?.total ?? 0} students`,
      icon:  <Users size={18} />, color: "text-emerald-600",
      barPct: kpis.batchCoverage?.pct ?? 0, barColor: "bg-emerald-500",
    },
    {
      label: "Slots Utilized",
      value: isLoading ? "—" : String(kpis.slotsUtilized?.count ?? 0),
      sub:   isLoading ? "Loading…" : `of ${kpis.slotsUtilized?.total ?? 0} created (${kpis.slotsUtilized?.pct ?? 0}%)`,
      icon:  <CalendarCheck size={18} />, color: "text-emerald-700",
      barPct: kpis.slotsUtilized?.pct ?? 0, barColor: "bg-emerald-500",
    },
    {
      label: "No-Show Rate",
      value: isLoading ? "—" : `${kpis.noShowRate?.pct ?? 0}%`,
      sub:   isLoading ? "Loading…" : `${kpis.noShowRate?.count ?? 0} missed sessions`,
      icon:  <AlertTriangle size={18} />, color: "text-amber-600",
      barPct: kpis.noShowRate?.pct ?? 0, barColor: "bg-amber-500",
    },
    {
      label: "Active Bans",
      value: isLoading ? "—" : String(kpis.activeBans ?? 0),
      sub:   "Students currently restricted",
      icon:  <Ban size={18} />, color: "text-red-600",
      barPct: Math.min((kpis.activeBans ?? 0) * 10, 100), barColor: "bg-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div key={i} className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800/60 uppercase tracking-widest mb-3">
              {kpi.icon} {kpi.label}
            </div>
            <div className={`text-3xl font-black mb-1 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs font-semibold text-emerald-700/70">{kpi.sub}</div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
              <div className={`h-full ${kpi.barColor}`} style={{ width: `${kpi.barPct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-emerald-950 mb-1">Milestone Focus</h3>
          <p className="text-xs font-semibold text-emerald-700/60 mb-6">Booking purpose distribution</p>
          {purposeDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-bold text-emerald-800/30">
              {isLoading ? "Loading…" : "No data yet"}
            </div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeDistribution} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                      {purposeDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }} itemStyle={{ color: "#000000", fontWeight: "bold" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {purposeDistribution.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900/70">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {entry.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-emerald-950 mb-1">Mentor Utilization</h3>
          <p className="text-xs font-semibold text-emerald-700/60 mb-6">Slots offered vs. completed per mentor</p>
          {mentorUtilization.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs font-bold text-emerald-800/30">
              {isLoading ? "Loading…" : "No data yet"}
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mentorUtilization} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#000000", fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#000000", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "rgba(177,59,53,0.07)" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="offered" name="Slots Offered" fill="#dfcac8" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="completed" name="Completed" fill="#b13b35" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-emerald-950 flex items-center gap-2">
            <ActivitySquare size={18} className="text-emerald-600" /> Recent Activity
          </h3>
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-emerald-900/10 text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs font-bold text-emerald-800/30">Loading…</td></tr>
              ) : recentAuditEvents.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-xs font-bold text-emerald-800/30">No events yet</td></tr>
              ) : (
                recentAuditEvents.map((e) => {
                  const detail = parseMeta(e.action, e.meta);
                  return (
                    <tr key={e.id} className="border-b border-emerald-900/5 hover:bg-emerald-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${ACTION_BADGE[e.action] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          <Activity size={10} />
                          {ACTION_LABEL[e.action] ?? e.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-700/60 text-xs">{fmtTime(e.createdAt)}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-950 text-xs truncate max-w-[140px]">{e.userEmail}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">{e.entity}</span>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-700/60">
                        {detail ?? <span className="text-emerald-900/20">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Whitelist Tab ─────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  SuperADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  AIGs:       "bg-amber-100 text-amber-800 border-amber-200",
  MENTOR:     "bg-emerald-100 text-emerald-800 border-emerald-200",
  STUDENT:    "bg-slate-100 text-slate-700 border-slate-200",
};

function WhitelistTab() {
  const { data: whitelist = [], isLoading } = useWhitelist();
  const { data: aigs = [] }                 = useAigs();
  const addMutation                         = useAddWhitelist();
  const removeMutation                      = useRemoveWhitelist();

  const [addEmail, setAddEmail]       = useState("");
  const [addRole, setAddRole]         = useState("STUDENT");
  const [addAigSlug, setAddAigSlug]   = useState("");
  const [search, setSearch]           = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    addMutation.mutate(
      { email: addEmail, role: addRole, aigSlug: addAigSlug || undefined },
      {
        onSuccess: () => { setAddEmail(""); setAddRole("STUDENT"); setAddAigSlug(""); },
      },
    );
  };

  const handleRemove = (id, email) => {
    if (!confirm(`Remove ${email} from the whitelist?`)) return;
    removeMutation.mutate(id, {
      onError: (err) => alert(err.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-emerald-950 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-emerald-600" /> Add to Whitelist
        </h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            type="email" placeholder="email@iiml.ac.in" value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)} required
            className="w-full bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
          />
          <div className="flex gap-3">
            <select value={addRole} onChange={(e) => { setAddRole(e.target.value); setAddAigSlug(""); }}
              className="flex-1 bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none">
              <option value="STUDENT">STUDENT</option>
              <option value="MENTOR">MENTOR</option>
              <option value="AIGs">AIGs</option>
              <option value="SuperADMIN">SuperADMIN</option>
            </select>
            {addRole === "AIGs" && (
              <select value={addAigSlug} onChange={(e) => setAddAigSlug(e.target.value)} required
                className="flex-1 bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none">
                <option value="">Select AIG…</option>
                {aigs.map((a) => <option key={a.id} value={a.slug}>{a.name}</option>)}
              </select>
            )}
          </div>
          {addMutation.error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {addMutation.error.message}
            </p>
          )}
          <button type="submit" disabled={addMutation.isPending || !addEmail}
            className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-sm transition-colors">
            {addMutation.isPending ? "Adding…" : "Add User"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-900/5 flex items-center gap-3">
          <h3 className="font-bold text-emerald-950 shrink-0">
            Approved Users{" "}
            <span className="text-emerald-700/50 font-semibold text-sm">({whitelist.length})</span>
          </h3>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/40" />
            <input
              type="text"
              placeholder="Search email or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8F8F8] border border-emerald-900/10 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="divide-y divide-emerald-900/5 max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">Loading…</div>
          ) : whitelist.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">No entries</div>
          ) : (
            whitelist
              .filter((e) =>
                !search.trim() ||
                e.email.toLowerCase().includes(search.toLowerCase()) ||
                e.role.toLowerCase().includes(search.toLowerCase()) ||
                (e.aigName ?? "").toLowerCase().includes(search.toLowerCase())
              )
              .map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-emerald-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-emerald-950 truncate">{entry.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${ROLE_BADGE[entry.role] ?? ROLE_BADGE.STUDENT}`}>
                      {entry.role}
                    </span>
                    {entry.aigName && (
                      <span className="text-[10px] font-bold text-emerald-700/60">{entry.aigName}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(entry.id, entry.email)}
                  disabled={removeMutation.isPending}
                  className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const { data: config = {}, isLoading } = useConfig();
  const saveMutation                     = useSaveConfig();

  const [deadline,     setDeadline]     = useState("");
  const [warnAt,       setWarnAt]       = useState("");
  const [strikeAt,     setStrikeAt]     = useState("");
  const [warnToStrike, setWarnToStrike] = useState("");

  useEffect(() => {
    if (config.cv_freeze_deadline) {
      const d     = new Date(config.cv_freeze_deadline);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setDeadline(local);
    }
    if (config.penalty_warning_minutes   !== undefined) setWarnAt(config.penalty_warning_minutes);
    if (config.penalty_strike_minutes    !== undefined) setStrikeAt(config.penalty_strike_minutes);
    if (config.penalty_warning_to_strike !== undefined) setWarnToStrike(config.penalty_warning_to_strike);
  }, [config.cv_freeze_deadline, config.penalty_warning_minutes, config.penalty_strike_minutes, config.penalty_warning_to_strike]);

  const isBookingOpen = config.booking_open === "true";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-emerald-950">Booking Window</h3>
            <p className="text-xs font-semibold text-emerald-700/60 mt-0.5">Allow students to create new bookings</p>
          </div>
          {isLoading ? (
            <div className="w-12 h-6 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <div
              onClick={() => saveMutation.mutate({ key: "booking_open", value: String(!isBookingOpen) })}
              className={`w-12 h-6 rounded-full ${isBookingOpen ? "bg-emerald-500" : "bg-slate-300"} relative cursor-pointer transition-colors ${saveMutation.isPending ? "opacity-60 pointer-events-none" : ""}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${isBookingOpen ? "left-7" : "left-1"}`} />
            </div>
          )}
        </div>
        <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${isBookingOpen ? "text-emerald-600" : "text-red-500"}`}>
          {isLoading ? "—" : isBookingOpen ? "Open — students can book" : "Closed — bookings paused"}
        </p>
      </div>

      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-red-500" />
          <h3 className="font-bold text-emerald-950">CV Freeze Deadline</h3>
        </div>
        <p className="text-xs font-semibold text-emerald-700/60 mb-4">
          After this timestamp, the Batch Readiness counter turns urgent for AIG admins.
        </p>
        <input
          type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          disabled={isLoading}
          className="w-full bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 mb-3"
        />
        <button
          onClick={() => saveMutation.mutate({ key: "cv_freeze_deadline", value: new Date(deadline).toISOString() })}
          disabled={!deadline || saveMutation.isPending || isLoading}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Save size={15} />
          {saveMutation.isPending ? "Saving…" : "Save Deadline"}
        </button>
      </div>

      {/* Penalty Thresholds */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-amber-500" />
          <h3 className="font-bold text-emerald-950">Cancellation Penalty Thresholds</h3>
        </div>
        <p className="text-xs font-semibold text-emerald-700/60 mb-5">
          Controls when warnings and strikes are applied on late cancellations.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
              Warning threshold (minutes before slot)
            </label>
            <div className="flex gap-2">
              <input
                type="number" min={1} value={warnAt}
                onChange={(e) => setWarnAt(e.target.value)}
                disabled={isLoading}
                placeholder="60"
                className="flex-1 bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => saveMutation.mutate({ key: "penalty_warning_minutes", value: warnAt })}
                disabled={!warnAt || saveMutation.isPending || isLoading}
                className="px-4 py-2.5 bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5"
              >
                <Save size={13} /> Save
              </button>
            </div>
            <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
              Cancel ≥ this many minutes before → no penalty
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
              Strike threshold (minutes before slot)
            </label>
            <div className="flex gap-2">
              <input
                type="number" min={1} value={strikeAt}
                onChange={(e) => setStrikeAt(e.target.value)}
                disabled={isLoading}
                placeholder="30"
                className="flex-1 bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => saveMutation.mutate({ key: "penalty_strike_minutes", value: strikeAt })}
                disabled={!strikeAt || saveMutation.isPending || isLoading}
                className="px-4 py-2.5 bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5"
              >
                <Save size={13} /> Save
              </button>
            </div>
            <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
              Cancel &lt; this many minutes before → immediate strike
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
              Warnings before ban (count)
            </label>
            <div className="flex gap-2">
              <input
                type="number" min={1} value={warnToStrike}
                onChange={(e) => setWarnToStrike(e.target.value)}
                disabled={isLoading}
                placeholder="3"
                className="flex-1 bg-[#F8F8F8] border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => saveMutation.mutate({ key: "penalty_warning_to_strike", value: warnToStrike })}
                disabled={!warnToStrike || saveMutation.isPending || isLoading}
                className="px-4 py-2.5 bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5"
              >
                <Save size={13} /> Save
              </button>
            </div>
            <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
              Accumulate this many warnings → escalated to strike
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bans Tab ──────────────────────────────────────────────────────────────────

function BansTab() {
  const { data: bans = [], isLoading } = useBans();
  const liftMutation                   = useLiftBan();

  const handleLift = (id, email) => {
    if (!confirm(`Lift ban for ${email}? They will immediately be able to book again.`)) return;
    liftMutation.mutate(id, {
      onError: (err) => alert(err.message),
    });
  };

  const fmtExpiry = (d) =>
    d
      ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "Permanent";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-900/5 flex items-center justify-between">
          <h3 className="font-bold text-emerald-950 flex items-center gap-2">
            <Ban size={16} className="text-red-500" /> Active Bans
            {!isLoading && <span className="text-emerald-700/50 font-semibold text-sm">({bans.length})</span>}
          </h3>
          {bans.length > 0 && (
            <span className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {bans.length} Restricted
            </span>
          )}
        </div>
        <div className="divide-y divide-emerald-900/5">
          {isLoading ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">Loading…</div>
          ) : bans.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-xs font-bold text-emerald-800/30">No active bans</div>
              <p className="text-[10px] font-semibold text-emerald-700/40 mt-1">All students are currently unrestricted</p>
            </div>
          ) : (
            bans.map((ban) => (
              <div key={ban.id} className="flex items-center justify-between px-5 py-4 hover:bg-red-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-emerald-950">{ban.userName}</p>
                  <p className="text-xs font-semibold text-emerald-700/60">{ban.userEmail}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                      {ban.reason}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700/50">Expires: {fmtExpiry(ban.endsAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleLift(ban.id, ban.userEmail)}
                  disabled={liftMutation.isPending}
                  className="ml-4 px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-40 shrink-0"
                >
                  {liftMutation.isPending ? "Lifting…" : "Lift Ban"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PlacementAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen app-bg text-emerald-950 font-sans pb-12">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
            <Shield size={18} />
          </div>
          <div>Placements <span className="text-emerald-700 text-sm font-semibold ml-1">Admin Console</span></div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-emerald-700/60 bg-emerald-900/5 px-3 py-1.5 rounded-full border border-emerald-900/10">
            Last Sync: Live
          </span>
          <AvatarMenu />
        </div>
      </nav>

      <header className="bg-white border-b border-emerald-900/10 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-emerald-950">Batch Progress Overview</h1>
          <p className="text-sm font-semibold text-emerald-700/70">PGP &amp; ABM Cohorts · Academic Year 2026</p>
        </div>
        <button
          onClick={() => downloadCsv("/api/admin/export/roster", "batch-roster.csv")}
          className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-md flex items-center gap-2 text-sm"
        >
          <Download size={16} /> Export Full Roster CSV
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-1 bg-emerald-900/5 border border-emerald-900/10 rounded-xl p-1 w-fit mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-emerald-950 shadow-sm border border-emerald-900/10"
                  : "text-emerald-800/60 hover:text-emerald-950"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === "overview"  && <OverviewTab />}
        {activeTab === "whitelist" && <WhitelistTab />}
        {activeTab === "config"    && <ConfigTab />}
        {activeTab === "bans"      && <BansTab />}
        <AppFooter />
      </main>
    </div>
  );
}
