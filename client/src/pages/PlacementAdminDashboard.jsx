import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Users,
  CalendarCheck,
  Ban,
  Download,
  Shield,
  AlertTriangle,
  ActivitySquare,
  Lock,
  List,
  Settings,
  Plus,
  Trash2,
  Save,
  ShieldOff,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "../lib/apiClient";
import { useAuth } from "../context/useAuth";
import AvatarMenu from "../components/AvatarMenu";

const COLORS = ["#064E3B", "#047857", "#10B981", "#6EE7B7"];

const ACTION_LABEL = {
  BOOKING_CREATED: "Booking Created",
  BOOKING_CANCELLED: "Booking Cancelled",
  SLOT_RELEASED: "Slots Released",
  BOOKING_ATTENDED: "Attended",
  BOOKING_NO_SHOW: "No-Show Recorded",
  NO_SHOW_RECORDED: "No-Show Recorded",
  ATTENDANCE_RECORDED: "Attended",
  BAN_APPLIED: "Ban Applied",
};

const ACTION_BADGE = {
  BOOKING_CREATED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SLOT_RELEASED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BOOKING_ATTENDED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATTENDANCE_RECORDED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BOOKING_CANCELLED: "bg-amber-100 text-amber-800 border-amber-200",
  BOOKING_NO_SHOW: "bg-red-100 text-red-800 border-red-200",
  NO_SHOW_RECORDED: "bg-red-100 text-red-800 border-red-200",
  BAN_APPLIED: "bg-red-100 text-red-800 border-red-200",
};

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: <ActivitySquare size={14} /> },
  { id: "whitelist", label: "Whitelist", icon: <List size={14} /> },
  { id: "config", label: "Config", icon: <Settings size={14} /> },
  { id: "bans", label: "Bans", icon: <ShieldOff size={14} /> },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data, loading, error }) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700">
        {error}
      </div>
    );
  }

  const { kpis = {}, purposeDistribution = [], mentorUtilization = [], recentAuditEvents = [] } =
    data ?? {};

  const kpiCards = [
    {
      label: "Batch Coverage",
      value: loading ? "—" : `${kpis.batchCoverage?.pct ?? 0}%`,
      sub: loading ? "Loading…" : `${kpis.batchCoverage?.covered ?? 0} / ${kpis.batchCoverage?.total ?? 0} students`,
      icon: <Users size={18} />,
      color: "text-emerald-600",
      barPct: kpis.batchCoverage?.pct ?? 0,
      barColor: "bg-emerald-500",
    },
    {
      label: "Slots Utilized",
      value: loading ? "—" : String(kpis.slotsUtilized?.count ?? 0),
      sub: loading ? "Loading…" : `of ${kpis.slotsUtilized?.total ?? 0} created (${kpis.slotsUtilized?.pct ?? 0}%)`,
      icon: <CalendarCheck size={18} />,
      color: "text-emerald-700",
      barPct: kpis.slotsUtilized?.pct ?? 0,
      barColor: "bg-emerald-500",
    },
    {
      label: "No-Show Rate",
      value: loading ? "—" : `${kpis.noShowRate?.pct ?? 0}%`,
      sub: loading ? "Loading…" : `${kpis.noShowRate?.count ?? 0} missed sessions`,
      icon: <AlertTriangle size={18} />,
      color: "text-amber-600",
      barPct: kpis.noShowRate?.pct ?? 0,
      barColor: "bg-amber-500",
    },
    {
      label: "Active Bans",
      value: loading ? "—" : String(kpis.activeBans ?? 0),
      sub: "Students currently restricted",
      icon: <Ban size={18} />,
      color: "text-red-600",
      barPct: Math.min((kpis.activeBans ?? 0) * 10, 100),
      barColor: "bg-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <div
            key={i}
            className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm relative overflow-hidden"
          >
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-emerald-950 mb-1">Milestone Focus</h3>
          <p className="text-xs font-semibold text-emerald-700/60 mb-6">
            Booking purpose distribution
          </p>
          {purposeDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs font-bold text-emerald-800/30">
              {loading ? "Loading…" : "No data yet"}
            </div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={purposeDistribution}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {purposeDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}
                      itemStyle={{ color: "#02120A", fontWeight: "bold" }}
                    />
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
          <p className="text-xs font-semibold text-emerald-700/60 mb-6">
            Slots offered vs. completed per mentor
          </p>
          {mentorUtilization.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs font-bold text-emerald-800/30">
              {loading ? "Loading…" : "No data yet"}
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mentorUtilization} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#064E3B", fontSize: 12, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#064E3B", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "rgba(16,185,129,0.05)" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="offered" name="Slots Offered" fill="#A7F3D0" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="completed" name="Completed" fill="#047857" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Live Audit Events */}
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
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-emerald-900/10 text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Entity</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs font-bold text-emerald-800/30">
                    Loading…
                  </td>
                </tr>
              ) : recentAuditEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs font-bold text-emerald-800/30">
                    No events yet
                  </td>
                </tr>
              ) : (
                recentAuditEvents.map((e) => (
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
                      <span className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                        {e.entity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Whitelist Tab ─────────────────────────────────────────────────────────────

function WhitelistTab() {
  const [whitelist, setWhitelist] = useState([]);
  const [aigs, setAigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("STUDENT");
  const [addAigSlug, setAddAigSlug] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  const fetchWhitelist = useCallback(async () => {
    const [list, aigList] = await Promise.all([
      apiFetch("/admin/whitelist"),
      apiFetch("/aigs"),
    ]);
    setWhitelist(list);
    setAigs(aigList);
  }, []);

  useEffect(() => {
    fetchWhitelist().finally(() => setLoading(false));
  }, [fetchWhitelist]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await apiFetch("/admin/whitelist", {
        method: "POST",
        body: JSON.stringify({ email: addEmail, role: addRole, aigSlug: addAigSlug || undefined }),
      });
      setAddEmail("");
      setAddRole("STUDENT");
      setAddAigSlug("");
      await fetchWhitelist();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id, email) => {
    if (!confirm(`Remove ${email} from the whitelist?`)) return;
    try {
      await apiFetch(`/admin/whitelist/${id}`, { method: "DELETE" });
      await fetchWhitelist();
    } catch (err) {
      alert(err.message);
    }
  };

  const ROLE_BADGE = {
    SuperADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    AIGs: "bg-amber-100 text-amber-800 border-amber-200",
    MENTOR: "bg-emerald-100 text-emerald-800 border-emerald-200",
    STUDENT: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="space-y-6">
      {/* Add Form */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-emerald-950 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-emerald-600" /> Add to Whitelist
        </h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <input
            type="email"
            placeholder="email@iiml.ac.in"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            required
            className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500"
          />
          <div className="flex gap-3">
            <select
              value={addRole}
              onChange={(e) => { setAddRole(e.target.value); setAddAigSlug(""); }}
              className="flex-1 bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none"
            >
              <option value="STUDENT">STUDENT</option>
              <option value="MENTOR">MENTOR</option>
              <option value="AIGs">AIGs</option>
              <option value="SuperADMIN">SuperADMIN</option>
            </select>
            {addRole === "AIGs" && (
              <select
                value={addAigSlug}
                onChange={(e) => setAddAigSlug(e.target.value)}
                required
                className="flex-1 bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none"
              >
                <option value="">Select AIG…</option>
                {aigs.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
          {addError && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {addError}
            </p>
          )}
          <button
            type="submit"
            disabled={adding || !addEmail}
            className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {adding ? "Adding…" : "Add User"}
          </button>
        </form>
      </div>

      {/* Whitelist Table */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-900/5">
          <h3 className="font-bold text-emerald-950">
            Approved Users{" "}
            <span className="text-emerald-700/50 font-semibold text-sm">
              ({whitelist.length})
            </span>
          </h3>
        </div>
        <div className="divide-y divide-emerald-900/5">
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">Loading…</div>
          ) : whitelist.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">No entries</div>
          ) : (
            whitelist.map((entry) => (
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
                  className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
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
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    apiFetch("/admin/config")
      .then((c) => {
        setConfig(c);
        // Convert ISO to datetime-local format
        if (c.cv_freeze_deadline) {
          const d = new Date(c.cv_freeze_deadline);
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setDeadline(local);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveKey = async (key, value) => {
    setSavingKey(key);
    try {
      const updated = await apiFetch(`/admin/config/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setConfig((prev) => ({ ...prev, [updated.key]: updated.value }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const isBookingOpen = config.booking_open === "true";

  return (
    <div className="space-y-4">
      {/* Booking Window Toggle */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-emerald-950">Booking Window</h3>
            <p className="text-xs font-semibold text-emerald-700/60 mt-0.5">
              Allow students to create new bookings
            </p>
          </div>
          {loading ? (
            <div className="w-12 h-6 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <div
              onClick={() => saveKey("booking_open", String(!isBookingOpen))}
              className={`w-12 h-6 rounded-full ${isBookingOpen ? "bg-emerald-500" : "bg-slate-300"} relative cursor-pointer transition-colors ${savingKey === "booking_open" ? "opacity-60 pointer-events-none" : ""}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${isBookingOpen ? "left-7" : "left-1"}`} />
            </div>
          )}
        </div>
        <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${isBookingOpen ? "text-emerald-600" : "text-red-500"}`}>
          {loading ? "—" : isBookingOpen ? "Open — students can book" : "Closed — bookings paused"}
        </p>
      </div>

      {/* CV Freeze Deadline */}
      <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-red-500" />
          <h3 className="font-bold text-emerald-950">CV Freeze Deadline</h3>
        </div>
        <p className="text-xs font-semibold text-emerald-700/60 mb-4">
          After this timestamp, the Batch Readiness counter turns urgent for AIG admins.
        </p>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          disabled={loading}
          className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 mb-3"
        />
        <button
          onClick={() => saveKey("cv_freeze_deadline", new Date(deadline).toISOString())}
          disabled={!deadline || savingKey === "cv_freeze_deadline" || loading}
          className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Save size={15} />
          {savingKey === "cv_freeze_deadline" ? "Saving…" : "Save Deadline"}
        </button>
      </div>
    </div>
  );
}

// ── Bans Tab ──────────────────────────────────────────────────────────────────

function BansTab() {
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liftingId, setLiftingId] = useState(null);

  const fetchBans = useCallback(async () => {
    const data = await apiFetch("/admin/bans");
    setBans(data);
  }, []);

  useEffect(() => {
    fetchBans().finally(() => setLoading(false));
  }, [fetchBans]);

  const handleLift = async (id, email) => {
    if (!confirm(`Lift ban for ${email}? They will immediately be able to book again.`)) return;
    setLiftingId(id);
    try {
      await apiFetch(`/admin/bans/${id}/lift`, { method: "PATCH" });
      await fetchBans();
    } catch (err) {
      alert(err.message);
    } finally {
      setLiftingId(null);
    }
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
            {!loading && (
              <span className="text-emerald-700/50 font-semibold text-sm">({bans.length})</span>
            )}
          </h3>
          {bans.length > 0 && (
            <span className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {bans.length} Restricted
            </span>
          )}
        </div>
        <div className="divide-y divide-emerald-900/5">
          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-emerald-800/30">Loading…</div>
          ) : bans.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-xs font-bold text-emerald-800/30">No active bans</div>
              <p className="text-[10px] font-semibold text-emerald-700/40 mt-1">
                All students are currently unrestricted
              </p>
            </div>
          ) : (
            bans.map((ban) => (
              <div
                key={ban.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-red-50/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-emerald-950">{ban.userName}</p>
                  <p className="text-xs font-semibold text-emerald-700/60">{ban.userEmail}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                      {ban.reason}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700/50">
                      Expires: {fmtExpiry(ban.endsAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleLift(ban.id, ban.userEmail)}
                  disabled={liftingId === ban.id}
                  className="ml-4 px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-40 shrink-0"
                >
                  {liftingId === ban.id ? "Lifting…" : "Lift Ban"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlacementAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  useEffect(() => {
    apiFetch("/admin/batch")
      .then(setOverviewData)
      .catch((e) => setOverviewError(e.message))
      .finally(() => setOverviewLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-12">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
            <Shield size={18} />
          </div>
          <div>
            Placements{" "}
            <span className="text-emerald-700 text-sm font-semibold ml-1">Admin Console</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-emerald-700/60 bg-emerald-900/5 px-3 py-1.5 rounded-full border border-emerald-900/10">
            Last Sync: Live
          </span>
          <AvatarMenu />
        </div>
      </nav>

      {/* Header */}
      <header className="bg-white border-b border-emerald-900/10 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-emerald-950">Batch Progress Overview</h1>
          <p className="text-sm font-semibold text-emerald-700/70">
            PGP & ABM Cohorts · Academic Year 2026
          </p>
        </div>
        <button className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-md flex items-center gap-2 text-sm">
          <Download size={16} /> Export Full Roster CSV
        </button>
      </header>

      {/* Tab Bar */}
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

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">
        {activeTab === "overview" && (
          <OverviewTab data={overviewData} loading={overviewLoading} error={overviewError} />
        )}
        {activeTab === "whitelist" && <WhitelistTab />}
        {activeTab === "config" && <ConfigTab />}
        {activeTab === "bans" && <BansTab />}
      </main>
    </div>
  );
}
