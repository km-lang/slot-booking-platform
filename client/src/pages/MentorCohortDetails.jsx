import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { apiFetch } from "../lib/apiClient";

export default function MentorCohortDetails() {
  const navigate = useNavigate();

  const [cohortData, setCohortData] = useState({ cohort: null, members: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    apiFetch("/cohort")
      .then(setCohortData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const { cohort, members } = cohortData;

  const filteredMembers = searchQuery.trim()
    ? members.filter(
        (m) =>
          m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.pgp?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : members;

  const headerLabel = cohort
    ? `${cohort.label} · ${cohort.memberCount} Mentees`
    : loading
    ? "Loading…"
    : "Cohort Tracker";

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col">
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
                {headerLabel}
              </p>
            </div>
          </div>
          <button className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg hover:bg-emerald-100 transition-colors">
            <Download size={16} />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="relative mb-6">
            <Search size={18} className="absolute left-3 top-3.5 text-emerald-900/40" />
            <input
              type="text"
              placeholder="Search cohort members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700 mb-4">
              {error}
            </div>
          )}

          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
            {loading ? (
              <div className="p-8 text-center text-emerald-800/40 text-sm font-bold">Loading cohort…</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-emerald-800/40 text-sm font-bold">
                {searchQuery ? `No results for "${searchQuery}"` : "No cohort members found"}
              </div>
            ) : (
              filteredMembers.map((mentee) => {
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
                          {mentee.isBanned && (
                            <span className="ml-2 bg-red-100 text-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                              Banned
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded border
                        ${isWarning
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isReady
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"}`}
                      >
                        {isWarning && <AlertCircle size={10} />}
                        {isReady && <CheckCircle2 size={10} />}
                        {mentee.status}
                      </div>
                    </div>

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

                    <a
                      href={`mailto:${mentee.email}`}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border
                      ${isWarning
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                        : "bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-200"}`}
                    >
                      <MessageCircle size={14} />
                      {isWarning ? "Nudge Mentee" : "Message"}
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
