import React from "react";
import {
  Shield,
  Users,
  BarChart3,
  History,
  Download,
  ChevronRight,
  ActivitySquare,
} from "lucide-react";

export default function PlacementAdminDashboard() {
  const pcomActions = [
    {
      id: 1,
      title: "Batch Level Stats",
      desc: "Overall coverage, CV freeze readiness, and total slot utilization.",
      icon: <Users size={24} />,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      id: 2,
      title: "Mentor-Wise Distribution",
      desc: "Active slots, completion rates, and load balancing per mentor.",
      icon: <BarChart3 size={24} />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      id: 3,
      title: "AIG / CCA Overall Stats",
      desc: "Compare contribution between Team Disha, Consulting, Finance, etc.",
      icon: <ActivitySquare size={24} />,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      id: 4,
      title: "Historical Audit Logs",
      desc: "Search mentor-wise and mentee-wise booking history and bans.",
      icon: <History size={24} />,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-24">
      {/* PCOM Header */}
      <header className="bg-emerald-900 text-white px-6 py-5 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-emerald-400" />
            <div>
              <h1 className="font-black text-xl leading-tight">
                Placements Command Center
              </h1>
              <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest mt-0.5">
                SIP 2026 Admin Panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-900 bg-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-pulse"></span>{" "}
              Live System
            </span>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold border border-white/20">
              PC
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-black text-emerald-950">
              Reporting & Analytics
            </h2>
            <p className="text-sm font-semibold text-emerald-700/70">
              Select a module to view real-time statistics and download CSV
              reports.
            </p>
          </div>
        </div>

        {/* 4 PCOM Requirements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pcomActions.map((action) => (
            <button
              key={action.id}
              className="bg-white border border-emerald-900/10 p-6 rounded-2xl flex items-center justify-between group hover:border-emerald-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start gap-5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${action.bg} ${action.color}`}
                >
                  {action.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-emerald-950 mb-1">
                    {action.title}
                  </h3>
                  <p className="text-xs font-semibold text-emerald-800/60 leading-relaxed max-w-sm">
                    {action.desc}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={24}
                className="text-emerald-900/20 group-hover:text-emerald-600 transition-colors group-hover:translate-x-1"
              />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
