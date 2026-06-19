import React, { useState } from "react";
import {
  Shield,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Search,
  Mail,
  Bell,
} from "lucide-react";

export default function TeamDishaDashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock Data for Cohorts
  const cohorts = [
    {
      id: "C4",
      mentor: "Evelyn Vance",
      total: 12,
      reviewed: 10,
      pending: 2,
      status: "On Track",
    },
    {
      id: "C5",
      mentor: "Marcus Thorne",
      total: 12,
      reviewed: 4,
      pending: 8,
      status: "Critical",
    },
    {
      id: "C6",
      mentor: "Rahul Menon",
      total: 12,
      reviewed: 12,
      pending: 0,
      status: "Completed",
    },
  ];

  // Mock Data for Intervention List
  const atRiskStudents = [
    {
      name: "Dhriti Srivastava",
      pgp: "25089",
      cohort: "C5",
      reason: "Zero Bookings",
      daysRemaining: 3,
    },
    {
      name: "John Doe",
      pgp: "25102",
      cohort: "C5",
      reason: "Missed Slot (Banned)",
      daysRemaining: 3,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-24 sm:bg-slate-100">
      <div className="max-w-md md:max-w-4xl mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative">
        {/* --- Sticky Header --- */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 font-bold text-emerald-950">
              <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
                <Shield size={18} />
              </div>
              <div>
                Team Disha{" "}
                <span className="text-[10px] uppercase tracking-widest text-emerald-600 block leading-none mt-0.5">
                  Cohort Control
                </span>
              </div>
            </div>
            <button className="relative w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-800 border border-emerald-200">
              <Bell size={16} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
          </div>

          {/* CV Freeze Countdown Banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-red-800 mb-0.5">
                Master CV Freeze
              </h2>
              <div className="text-sm font-bold text-red-950">
                Ends in <span className="text-red-600">3 Days, 14 Hrs</span>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6">
          {/* --- Global Batch Progress --- */}
          <section className="mb-8">
            <div className="flex justify-between items-end mb-3">
              <h2 className="text-lg font-black text-emerald-950">
                Batch Readiness
              </h2>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                PGP1 2026
              </span>
            </div>
            <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl font-black text-emerald-950">
                  72%
                </span>
                <span className="text-xs font-bold text-emerald-700/60">
                  432 / 600 Cleared
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 w-[72%] h-full rounded-full"></div>
              </div>
            </div>
          </section>

          {/* --- Intervention Required (At Risk) --- */}
          <section className="mb-8">
            <h2 className="text-lg font-black text-emerald-950 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />{" "}
              Intervention Required
            </h2>
            <div className="space-y-3">
              {atRiskStudents.map((student, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-amber-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-[14px] text-emerald-950 leading-tight">
                      {student.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-amber-50 text-amber-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-200/50">
                        {student.reason}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700/60">
                        {student.cohort}
                      </span>
                    </div>
                  </div>
                  <button className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors border border-emerald-200 shrink-0">
                    <Mail size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* --- Cohort Tracking --- */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-emerald-950">
                Cohort Drilldown
              </h2>
            </div>

            {/* Mobile Search */}
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-3 text-emerald-900/40"
              />
              <input
                type="text"
                placeholder="Search cohort or mentor..."
                className="w-full bg-white border border-emerald-900/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  className="bg-white border border-emerald-900/10 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-800 border border-emerald-200 text-xs">
                        {cohort.id}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
                          {cohort.mentor}
                        </div>
                        <div className="font-bold text-sm text-emerald-950">
                          {cohort.reviewed} / {cohort.total} Cleared
                        </div>
                      </div>
                    </div>
                    {cohort.status === "Completed" && (
                      <CheckCircle size={18} className="text-emerald-500" />
                    )}
                    {cohort.status === "Critical" && (
                      <AlertTriangle size={18} className="text-red-500" />
                    )}
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cohort.status === "Critical" ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{
                        width: `${(cohort.reviewed / cohort.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
