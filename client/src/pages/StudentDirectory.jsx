import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Briefcase,
  Users,
  User,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function StudentDirectory() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock Mentor Categories
  const categories = ["All", "Team Disha", "Consulting Club", "Alumni Mentors"];

  // Mock Mentor Database
  const mentors = [
    {
      id: "evelyn-vance",
      name: "Dr. Evelyn Vance",
      group: "Team Disha",
      role: "Faculty",
      activeSlots: 4,
      isLive: true,
    },
    {
      id: "marcus-thorne",
      name: "Prof. Marcus Thorne",
      group: "Team Disha",
      role: "Faculty",
      activeSlots: 2,
      isLive: true,
      reserved: "Q4",
    },
    {
      id: "priya-sharma",
      name: "Priya Sharma",
      group: "Alumni Mentors",
      role: "Alumni",
      activeSlots: 6,
      isLive: true,
    },
    {
      id: "rahul-menon",
      name: "Rahul Menon",
      group: "Team Disha",
      role: "Faculty",
      activeSlots: 0,
      isLive: false,
    },
    {
      id: "amit-singh",
      name: "Amit Singh",
      group: "Consulting Club",
      role: "AIG Member",
      activeSlots: 3,
      isLive: true,
    },
  ];

  const filteredMentors = mentors.filter((m) => {
    const matchesTab = activeTab === "All" || m.group === activeTab;
    const matchesSearch = m.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-20">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 glass-panel px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
            <Shield size={18} />
          </div>
          <div>Mentor Directory</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
          <User size={14} className="text-emerald-800" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-emerald-950 mb-2">
              Book a Session
            </h1>
            <p className="text-sm font-semibold text-emerald-700/70">
              Select a mentor to view their available slots.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search
              size={18}
              className="absolute left-3 top-3 text-emerald-900/40"
            />
            <input
              type="text"
              placeholder="Search mentors by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-emerald-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {categories.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors border ${
                activeTab === tab
                  ? "bg-emerald-900 text-white border-emerald-900 shadow-md"
                  : "bg-white text-emerald-800 border-emerald-900/10 hover:bg-emerald-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mentor Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMentors.map((mentor) => (
            <div
              key={mentor.id}
              onClick={() =>
                navigate(
                  `/student/${mentor.group.toLowerCase().replace(" ", "-")}/${mentor.id}`,
                )
              }
              className="glass-card p-5 rounded-2xl cursor-pointer group flex flex-col justify-between h-full"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border ${
                      mentor.isLive
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-400 border-slate-200"
                    }`}
                  >
                    {mentor.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)}
                  </div>
                  {mentor.isLive ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Live
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Offline
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-lg text-emerald-950 leading-tight mb-1">
                  {mentor.name}
                </h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold text-emerald-700/60 flex items-center gap-1">
                    {mentor.group.includes("Disha") ? (
                      <Briefcase size={12} />
                    ) : (
                      <Users size={12} />
                    )}
                    {mentor.group}
                  </span>
                  {mentor.reserved && (
                    <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                      Cohort {mentor.reserved}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-emerald-900/5">
                <span
                  className={`text-xs font-bold ${mentor.activeSlots > 0 ? "text-emerald-600" : "text-emerald-900/30"}`}
                >
                  {mentor.activeSlots} Slots Available
                </span>
                <ArrowRight
                  size={16}
                  className={`transition-transform group-hover:translate-x-1 ${mentor.isLive ? "text-emerald-600" : "text-emerald-900/20"}`}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
