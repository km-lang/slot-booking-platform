import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Shield, Briefcase, TrendingUp, CalendarCheck } from "lucide-react";
import { useAigs, useAigMentors, useAllMentors, useMyBookings } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";

const AIG_ICON = {
  disha:      <Shield size={20} />,
  consulting: <TrendingUp size={20} />,
  finance:    <Briefcase size={20} />,
};
const aigIcon = (slug) => AIG_ICON[slug] ?? <Briefcase size={20} />;

const MentorRow = ({ mentor, aigSlug }) => {
  const navigate = useNavigate();
  const isDisha = aigSlug === "disha";
  return (
    <button
      onClick={() => navigate(`/student/${aigSlug}/${mentor.id}`)}
      className="w-full bg-white p-4 flex items-center gap-4 hover:bg-emerald-50/80 active:bg-emerald-100/50 transition-colors relative overflow-hidden text-left"
    >
      {isDisha && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shrink-0 z-10 ${isDisha ? "bg-emerald-900 text-emerald-400" : "bg-emerald-100 text-emerald-800"}`}>
        {mentor.name?.split(" ").map((n) => n[0]).join("").substring(0, 2) ?? "?"}
      </div>
      <div className="flex-1 z-10">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-bold text-emerald-950 leading-tight">{mentor.name}</h3>
          {isDisha && (
            <span className="bg-emerald-900 text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
              <Shield size={8} /> Disha
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold text-emerald-700">
          {mentor.firm} <span className="text-emerald-900/30">|</span> {mentor.domain}
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

// Separate component per AIG row so each mounts its own useAigMentors hook
// only when expanded — React Query enables/disables the query via `enabled`.
const AigRow = ({ aig, isExpanded, onToggle }) => {
  const { data: mentors = [], isLoading } = useAigMentors(isExpanded ? aig.id : null);

  return (
    <div className="flex flex-col bg-white">
      <button
        onClick={onToggle}
        className={`w-full p-4 flex items-center gap-4 transition-colors ${isExpanded ? "bg-emerald-50/50" : "hover:bg-emerald-50/30"}`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${aig.id === "disha" ? "bg-emerald-900 text-emerald-400" : "bg-emerald-100 text-emerald-800"}`}>
          {aigIcon(aig.id)}
        </div>
        <div className="text-left flex-1">
          <h3 className="font-bold text-emerald-950">{aig.name}</h3>
          <p className="text-[11px] font-semibold text-emerald-700/60 mt-0.5">
            {aig.count} Mentors · {aig.type}
          </p>
        </div>
        <ChevronDown
          size={20}
          className={`text-emerald-900/40 transition-transform duration-300 ${isExpanded ? "rotate-180 text-emerald-700" : ""}`}
        />
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="bg-[#F8FAF7] border-t border-emerald-900/5 divide-y divide-emerald-900/5">
          {isLoading ? (
            <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading mentors…</div>
          ) : mentors.length > 0 ? (
            mentors.map((mentor) => (
              <MentorRow key={mentor.id} mentor={mentor} aigSlug={aig.id} />
            ))
          ) : (
            <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">No mentors available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function StudentDashboard() {
  const [expandedAig, setExpandedAig] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: aigs = [], isLoading: aigsLoading, error: aigsError } = useAigs();
  const isSearching = searchQuery.trim().length > 0;
  const { data: allMentors } = useAllMentors(isSearching);
  const { data: myBookingsData } = useMyBookings();
  const upcomingCount = myBookingsData?.upcoming?.length ?? 0;

  const filteredMentors = isSearching && allMentors
    ? allMentors.filter((m) => {
        const q = searchQuery.toLowerCase();
        return (
          m.name?.toLowerCase().includes(q) ||
          m.firm?.toLowerCase().includes(q) ||
          m.domain?.toLowerCase().includes(q)
        );
      })
    : [];

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col">
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="font-black text-lg leading-tight">Book your Slot</h1>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">SIP Prep 2026</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("/")}
              className="bg-emerald-900 hover:bg-emerald-800 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_10px_rgba(6,45,28,0.15)] active:scale-95 transition-all"
            >
              Shukracharya
            </button>
            <AvatarMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto pb-24">
          <div className="relative mb-6">
            <Search size={18} className="absolute left-3 top-3.5 text-emerald-900/40" />
            <input
              type="text"
              placeholder="Search by name, firm, or domain…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm transition-all"
            />
          </div>

          {/* My Sessions shortcut */}
          <button
            onClick={() => navigate("/student/bookings")}
            className="w-full flex items-center justify-between bg-white border border-emerald-900/10 rounded-xl px-4 py-3 shadow-sm hover:bg-emerald-50/50 active:bg-emerald-100/50 transition-colors mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CalendarCheck size={16} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm text-emerald-950">My Sessions</div>
                <div className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
                  {upcomingCount > 0 ? `${upcomingCount} upcoming` : "View booking history"}
                </div>
              </div>
            </div>
            {upcomingCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {upcomingCount}
              </span>
            )}
          </button>

          {aigsError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700 mb-4">
              Could not load groups: {aigsError.message}
            </div>
          )}

          {isSearching ? (
            <div className="animate-in fade-in duration-200">
              <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1">
                Search Results{allMentors && ` (${filteredMentors.length})`}
              </h2>
              <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
                {!allMentors ? (
                  <div className="p-8 text-center text-emerald-800/40 text-sm font-semibold">Loading…</div>
                ) : filteredMentors.length > 0 ? (
                  filteredMentors.map((mentor) => (
                    <MentorRow key={mentor.id} mentor={mentor} aigSlug={mentor.aigId} />
                  ))
                ) : (
                  <div className="p-8 text-center text-emerald-800/50 text-sm font-semibold">
                    No mentors found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-3 px-1">
                Preparation Groups
              </h2>
              {aigsLoading ? (
                <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm p-8 text-center text-emerald-800/40 text-sm font-semibold">
                  Loading groups…
                </div>
              ) : (
                <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
                  {aigs.map((aig) => (
                    <AigRow
                      key={aig.id}
                      aig={aig}
                      isExpanded={expandedAig === aig.id}
                      onToggle={() => setExpandedAig((prev) => (prev === aig.id ? null : aig.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
