import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Shield,
  Briefcase,
  TrendingUp,
} from "lucide-react";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [expandedAig, setExpandedAig] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // --- MOCK DATA ---
  const aigs = [
    {
      id: "disha",
      name: "Team Disha",
      type: "Core Preparation",
      icon: <Shield size={20} />,
      count: 17,
    },
    {
      id: "consulting",
      name: "Consulting & Strategy Club",
      type: "Domain AIG",
      icon: <TrendingUp size={20} />,
      count: 42,
    },
    {
      id: "finance",
      name: "Credence Capital",
      type: "Domain AIG",
      icon: <Briefcase size={20} />,
      count: 35,
    },
  ];

  const mentors = [
    {
      id: "evelyn-vance",
      aigId: "disha",
      name: "Evelyn Vance",
      firm: "McKinsey & Co.",
      domain: "Consulting",
      liveSlots: 3,
    },
    {
      id: "marcus-thorne",
      aigId: "disha",
      name: "Marcus Thorne",
      firm: "BCG",
      domain: "Consulting",
      liveSlots: 0,
    },
    {
      id: "amit-singh",
      aigId: "consulting",
      name: "Amit Singh",
      firm: "Bain & Co.",
      domain: "Consulting",
      liveSlots: 2,
    },
    {
      id: "priya-sharma",
      aigId: "finance",
      name: "Priya Sharma",
      firm: "Goldman Sachs",
      domain: "Finance",
      liveSlots: 1,
    },
  ];

  // --- SEARCH LOGIC ---
  const isSearching = searchQuery.trim().length > 0;
  const filteredMentors = isSearching
    ? mentors.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.firm.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.domain.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : [];

  const toggleAig = (aigId) => {
    setExpandedAig((prev) => (prev === aigId ? null : aigId));
  };

  // Reusable Mentor Card Component
  const MentorRow = ({ mentor, aigId }) => {
    const isDisha = aigId === "disha";
    return (
      <button
        onClick={() => navigate(`/student/${aigId}/${mentor.id}`)}
        className="w-full bg-white p-4 flex items-center gap-4 hover:bg-emerald-50/80 active:bg-emerald-100/50 transition-colors relative overflow-hidden text-left"
      >
        {/* Disha Highlight Bar */}
        {isDisha && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
        )}

        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-black shrink-0 z-10 ${isDisha ? "bg-emerald-900 text-emerald-400" : "bg-emerald-100 text-emerald-800"}`}
        >
          {mentor.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)}
        </div>

        <div className="flex-1 z-10">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-emerald-950 leading-tight">
              {mentor.name}
            </h3>
            {isDisha && (
              <span className="bg-emerald-900 text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                <Shield size={8} /> Disha
              </span>
            )}
          </div>
          <p className="text-[11px] font-bold text-emerald-700">
            {mentor.firm} <span className="text-emerald-900/30">|</span>{" "}
            {mentor.domain}
          </p>
        </div>

        <div className="flex flex-col items-end z-10 shrink-0">
          {mentor.liveSlots > 0 ? (
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
              {mentor.liveSlots} Slots
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
              Full
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="font-black text-lg leading-tight">Book your Slot</h1>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
              SIP Prep 2026
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="bg-emerald-900 hover:bg-emerald-800 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_10px_rgba(6,45,28,0.15)] active:scale-95 transition-all"
          >
            Shukracharya
          </button>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto pb-24">
          {/* Global Search Bar */}
          <div className="relative mb-6">
            <Search
              size={18}
              className="absolute left-3 top-3.5 text-emerald-900/40"
            />
            <input
              type="text"
              placeholder="Search by name, firm, or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm transition-all"
            />
          </div>

          {/* VIEW 1: GLOBAL SEARCH RESULTS (Overrides Accordion) */}
          {isSearching ? (
            <div className="animate-in fade-in duration-200">
              <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1">
                Search Results ({filteredMentors.length})
              </h2>
              <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
                {filteredMentors.length > 0 ? (
                  filteredMentors.map((mentor) => (
                    <MentorRow
                      key={mentor.id}
                      mentor={mentor}
                      aigId={mentor.aigId}
                    />
                  ))
                ) : (
                  <div className="p-8 text-center text-emerald-800/50 text-sm font-semibold">
                    No mentors found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VIEW 2: FLUSH ACCORDION LIST */
            <div className="animate-in fade-in duration-200">
              <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1">
                Preparation Groups
              </h2>

              {/* Unified Container for all AIGs (Removes gaps between them) */}
              <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
                {aigs.map((aig) => {
                  const isExpanded = expandedAig === aig.id;
                  const aigMentors = mentors.filter((m) => m.aigId === aig.id);

                  return (
                    <div key={aig.id} className="flex flex-col bg-white">
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleAig(aig.id)}
                        className={`w-full p-4 flex items-center gap-4 transition-colors ${isExpanded ? "bg-emerald-50/50" : "hover:bg-emerald-50/30"}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${aig.id === "disha" ? "bg-emerald-900 text-emerald-400" : "bg-emerald-100 text-emerald-800"}`}
                        >
                          {aig.icon}
                        </div>
                        <div className="text-left flex-1">
                          <h3 className="font-bold text-emerald-950">
                            {aig.name}
                          </h3>
                          <p className="text-[11px] font-semibold text-emerald-700/60 mt-0.5">
                            {aig.count} Mentors · {aig.type}
                          </p>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`text-emerald-900/40 transition-transform duration-300 ${isExpanded ? "rotate-180 text-emerald-700" : ""}`}
                        />
                      </button>

                      {/* Accordion Expanded Content (Mentors) */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
                      >
                        <div className="bg-[#F8FAF7] border-t border-emerald-900/5 divide-y divide-emerald-900/5">
                          {aigMentors.map((mentor) => (
                            <MentorRow
                              key={mentor.id}
                              mentor={mentor}
                              aigId={aig.id}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
