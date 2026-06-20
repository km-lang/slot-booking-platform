import React from "react";
import {
  Activity,
  Users,
  CalendarCheck,
  Ban,
  Download,
  Shield,
  AlertTriangle,
  ActivitySquare,
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

export default function PlacementAdminDashboard() {
  const purposeData = [
    { name: "Overall CV", value: 55 },
    { name: "Work Experience", value: 25 },
    { name: "POR / ECA", value: 15 },
    { name: "Academic", value: 5 },
  ];
  const COLORS = ["#064E3B", "#047857", "#10B981", "#6EE7B7"];

  const mentorUtilization = [
    { name: "Jenkins", offered: 60, completed: 48 },
    { name: "Thorne", offered: 45, completed: 38 },
    { name: "Priya Sharma", offered: 30, completed: 27 },
    { name: "Rahul Menon", offered: 40, completed: 31 },
    { name: "Vance", offered: 55, completed: 44 },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-12">
      <nav className="sticky top-0 z-50 glass-panel px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
            <Shield size={18} />
          </div>
          <div>
            Placements{" "}
            <span className="text-emerald-700 text-sm font-semibold ml-1">
              Admin Console
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-emerald-700/60 bg-emerald-900/5 px-3 py-1.5 rounded-full border border-emerald-900/10">
            Last Sync: Live
          </span>
          <div className="w-8 h-8 rounded-full bg-emerald-900 flex items-center justify-center font-bold text-emerald-50 border border-emerald-800">
            PC
          </div>
        </div>
      </nav>

      <header className="bg-white border-b border-emerald-900/10 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-emerald-950">
            Batch Progress Overview
          </h1>
          <p className="text-sm font-semibold text-emerald-700/70">
            PGP & ABM Cohorts · Academic Year 2026
          </p>
        </div>
        <button className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-2.5 px-5 rounded-xl transition-colors shadow-md flex items-center gap-2 text-sm">
          <Download size={16} /> Export Full Roster CSV
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Batch Coverage",
              value: "68%",
              sub: "408 / 600 students",
              icon: <Users size={18} />,
              color: "text-emerald-600",
              bar: "w-[68%]",
            },
            {
              label: "Slots Utilized",
              value: "450",
              sub: "of 850 created (52.9%)",
              icon: <CalendarCheck size={18} />,
              color: "text-emerald-700",
              bar: "w-[52%]",
            },
            {
              label: "No-Show Rate",
              value: "4.2%",
              sub: "19 missed sessions",
              icon: <AlertTriangle size={18} />,
              color: "text-amber-600",
              bar: "w-[4%] bg-amber-500",
            },
            {
              label: "Active Bans",
              value: "3",
              sub: "Students currently restricted",
              icon: <Ban size={18} />,
              color: "text-red-600",
              bar: "w-[2%] bg-red-500",
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800/60 uppercase tracking-widest mb-3">
                {kpi.icon} {kpi.label}
              </div>
              <div className={`text-3xl font-black mb-1 ${kpi.color}`}>
                {kpi.value}
              </div>
              <div className="text-xs font-semibold text-emerald-700/70">
                {kpi.sub}
              </div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
                <div
                  className={`h-full ${kpi.bar.includes("bg-") ? kpi.bar : kpi.bar + " bg-emerald-500"}`}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-emerald-950 mb-1">Milestone Focus</h3>
            <p className="text-xs font-semibold text-emerald-700/60 mb-6">
              Booking purpose distribution
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={purposeData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {purposeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                    itemStyle={{ color: "#02120A", fontWeight: "bold" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {purposeData.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900/70"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i] }}
                  ></span>
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-emerald-950 mb-1">
              Mentor Utilization
            </h3>
            <p className="text-xs font-semibold text-emerald-700/60 mb-6">
              Slots offered vs. completed per mentor
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mentorUtilization}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#064E3B", fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#064E3B", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(16, 185, 129, 0.05)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar
                    dataKey="offered"
                    name="Slots Offered"
                    fill="#A7F3D0"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Bar
                    dataKey="completed"
                    name="Slots Completed"
                    fill="#047857"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Live Operations Table */}
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-emerald-950 flex items-center gap-2">
              <ActivitySquare size={18} className="text-emerald-600" /> System
              Health & Live Monitoring
            </h3>
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>{" "}
              Live
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-emerald-900/10 text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Time</th>
                  <th className="py-3 px-4 font-bold">Event / Entity</th>
                  <th className="py-3 px-4 font-bold">Detail</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-emerald-900/5 hover:bg-emerald-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>{" "}
                      Active Window
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-700/60">
                    10:02 AM
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-950">
                    Q4 Cohort Release
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                      <Activity size={12} /> Traffic: High
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-emerald-600 font-bold hover:text-emerald-800 text-xs">
                      Monitor
                    </button>
                  </td>
                </tr>
                <tr className="border-b border-emerald-900/5 hover:bg-emerald-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{" "}
                      Delay Warning
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-700/60">
                    10:08 AM
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-950">
                    Jenkins
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-800/80">
                    Running 15 min late
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-emerald-600 font-bold hover:text-emerald-800 text-xs">
                      Notify
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-emerald-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{" "}
                      System Action
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-700/60">
                    09:54 AM
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-950">
                    18-hr ban applied
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                      PGP-25110
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-emerald-600 font-bold hover:text-emerald-800 text-xs">
                      Review
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
