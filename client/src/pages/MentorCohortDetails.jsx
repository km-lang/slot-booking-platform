import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";

export default function MentorCohortDetails() {
  const navigate = useNavigate();

  // Mock Granular Cohort Data
  const cohortMembers = [
    {
      id: 1,
      name: "Hrishikesh Kumar",
      pgp: "25110",
      status: "On Track",
      slotsTaken: 3,
      lastReview: "Yesterday",
      focus: "Consulting",
    },
    {
      id: 2,
      name: "Dhriti Srivastava",
      pgp: "25089",
      status: "Action Needed",
      slotsTaken: 0,
      lastReview: "Never",
      focus: "Unspecified",
    },
    {
      id: 3,
      name: "John Doe",
      pgp: "25102",
      status: "Ready",
      slotsTaken: 4,
      lastReview: "June 15",
      focus: "Finance",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/mentor")}
              className="p-2 -ml-2 rounded-full hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-black text-lg leading-tight text-emerald-950">
                Cohort Tracker
              </h1>
              <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
                Q4 · 12 Mentees
              </p>
            </div>
          </div>
          <button className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg hover:bg-emerald-100 transition-colors">
            <Download size={16} />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="relative mb-6">
            <Search
              size={18}
              className="absolute left-3 top-3.5 text-emerald-900/40"
            />
            <input
              type="text"
              placeholder="Search cohort members..."
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
            {cohortMembers.map((mentee) => {
              const isWarning = mentee.status === "Action Needed";
              const isReady = mentee.status === "Ready";

              return (
                <div key={mentee.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-[15px] text-emerald-950 leading-tight">
                        {mentee.name}
                      </h3>
                      <div className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
                        PGP-{mentee.pgp}
                      </div>
                    </div>
                    {/* Status Badge */}
                    <div
                      className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded border
                      ${
                        isWarning
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isReady
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {isWarning && <AlertCircle size={10} />}
                      {isReady && <CheckCircle2 size={10} />}
                      {mentee.status}
                    </div>
                  </div>

                  {/* Granular Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-3 bg-[#F8FAF7] rounded-xl p-3 border border-emerald-900/5">
                    <div>
                      <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">
                        Slots Taken
                      </div>
                      <div className="font-black text-sm text-emerald-950">
                        {mentee.slotsTaken}{" "}
                        <span className="text-[10px] text-emerald-700/60 font-semibold">
                          Sessions
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">
                        Last Review
                      </div>
                      <div className="font-black text-sm text-emerald-950">
                        {mentee.lastReview}
                      </div>
                    </div>
                  </div>

                  <button
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border
                    ${isWarning ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200" : "bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-200"}`}
                  >
                    <MessageCircle size={14} />
                    {isWarning ? "Nudge Mentee" : "Message"}
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
