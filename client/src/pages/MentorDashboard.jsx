import React, { useState } from "react";
import {
  Shield,
  Clock,
  MapPin,
  Video,
  Megaphone,
  CheckCircle2,
  Plus,
  Ban,
  Calendar,
  ChevronDown,
  Trash2,
} from "lucide-react";

export default function MentorDashboard() {
  const [delay, setDelay] = useState(15);
  const [pushedDelay, setPushedDelay] = useState(15);
  const [isReserved, setIsReserved] = useState(true);

  // Mock Data mimicking the PRD states
  const [slots, setSlots] = useState([
    {
      id: 1,
      start: "14:00",
      end: "14:15",
      venue: "Library - Ishwar Dayal",
      student: "Hrishikesh Kumar",
      pgp: "25110",
      pcom: "402",
      cohort: "Q4",
      purpose: "Overall CV Review",
      status: "Ongoing",
      mode: "in-person",
    },
    {
      id: 2,
      start: "14:15",
      end: "14:30",
      venue: "Online - Meet Link Active",
      student: "Ayushi Srivastava",
      pgp: "25089",
      pcom: "310",
      cohort: "Q4",
      purpose: "Work Experience",
      status: "Awaiting",
      mode: "online",
    },
    {
      id: 3,
      start: "14:30",
      end: "14:45",
      venue: "CC - Main Lab",
      student: null,
      reservedNote: "Reserved for Q4 Only",
      status: "Not Started",
      mode: "in-person",
      unbooked: true,
    },
    {
      id: 4,
      start: "13:30",
      end: "13:45",
      venue: "Library",
      student: "Student Name",
      pgp: "25145",
      pcom: "512",
      cohort: "Q4",
      purpose: "POR / ECA",
      status: "Completed",
      mode: "in-person",
      past: true,
    },
  ]);

  const updateStatus = (id, newStatus) => {
    setSlots(slots.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
  };

  const statusColors = {
    "Not Started": "bg-slate-100 text-slate-600 border-slate-200",
    Awaiting: "bg-amber-100 text-amber-700 border-amber-200",
    Ongoing: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Completed: "bg-slate-100 text-slate-500 border-slate-200",
    Missed: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-12">
      {/* --- Top Navigation --- */}
      <nav className="sticky top-0 z-50 glass-panel px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400 shadow-md">
            <Shield size={18} />
          </div>
          <div>
            Team Disha{" "}
            <span className="text-emerald-700 text-sm font-semibold ml-1">
              Mentor Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-1">
            {["My Slots", "Create New Slot", "Blacklist Directory"].map(
              (tab, i) => (
                <button
                  key={tab}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${i === 0 ? "bg-emerald-900 text-white" : "text-emerald-800 hover:bg-emerald-900/5"}`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center font-bold text-emerald-900 border border-emerald-300">
            SJ
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* --- Daily Operations Banner --- */}
        <section
          className={`mb-8 rounded-2xl p-5 sm:p-6 border transition-colors ${pushedDelay > 0 ? "bg-amber-50 border-amber-200 shadow-sm" : "glass-card"}`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pushedDelay > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}
              >
                <Megaphone size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg mb-1">
                  Daily Operations Control
                </h2>
                <p className="text-sm text-emerald-800/70">
                  System Status:{" "}
                  <span className="font-semibold text-emerald-600">Active</span>
                  .
                  {pushedDelay > 0
                    ? ` Students currently see a "Running ${pushedDelay} min late" banner.`
                    : " No delays are currently broadcasted to students."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center bg-white border border-emerald-900/10 rounded-xl px-3 py-2 shadow-sm">
                <Clock size={16} className="text-emerald-700 mr-2" />
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="w-12 bg-transparent outline-none font-bold text-emerald-950"
                  min="0"
                />
                <span className="text-sm font-semibold text-emerald-800/60 ml-1">
                  mins
                </span>
              </div>
              <button
                onClick={() => setPushedDelay(delay)}
                className="bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-2 px-5 rounded-xl transition-colors shadow-md text-sm whitespace-nowrap"
              >
                Push Update
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* --- Main Session Manager --- */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-emerald-950 mb-4 flex items-center justify-between">
              Today's Sessions
              <span className="text-xs font-semibold bg-white border border-emerald-900/10 px-3 py-1 rounded-full text-emerald-700">
                June 18, 2026
              </span>
            </h2>

            {slots.map((slot) => (
              <div
                key={slot.id}
                className={`glass-card p-5 rounded-2xl flex flex-col sm:flex-row gap-5 ${slot.past ? "opacity-60" : ""}`}
              >
                {/* Time & Venue */}
                <div className="sm:w-48 shrink-0 border-b sm:border-b-0 sm:border-r border-emerald-900/10 pb-4 sm:pb-0 sm:pr-4">
                  <div className="font-bold text-emerald-950 text-lg mb-1 flex items-center gap-2">
                    {slot.start} - {slot.end}
                  </div>
                  <div className="text-sm font-semibold text-emerald-700/80 flex items-center gap-1.5 mb-2">
                    {slot.mode === "online" ? (
                      <Video size={14} />
                    ) : (
                      <MapPin size={14} />
                    )}
                    {slot.venue.split(" - ")[0]}
                  </div>
                  {slot.venue.includes("-") && (
                    <div className="text-xs font-medium text-emerald-800/60 bg-emerald-900/5 px-2 py-1 rounded-md inline-block">
                      {slot.venue.split(" - ")[1]}
                    </div>
                  )}
                </div>

                {/* Student Info */}
                <div className="flex-1">
                  {slot.unbooked ? (
                    <div className="h-full flex flex-col justify-center">
                      <span className="font-bold text-emerald-800/50 mb-1">
                        Open / Unbooked
                      </span>
                      <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-1 rounded-md w-fit">
                        {slot.reservedNote}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-lg text-emerald-950 mb-1">
                        {slot.student}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800/70 mb-3">
                        <span className="bg-white border border-emerald-900/10 px-2 py-0.5 rounded">
                          PGP: {slot.pgp}
                        </span>
                        <span className="bg-white border border-emerald-900/10 px-2 py-0.5 rounded">
                          PCOM: {slot.pcom}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                          Cohort {slot.cohort}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-emerald-700">
                        <span className="text-emerald-900/40 mr-1">
                          Purpose:
                        </span>{" "}
                        {slot.purpose}
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="sm:w-40 shrink-0 flex flex-col items-start sm:items-end justify-center gap-3">
                  <div className="relative w-full">
                    <select
                      value={slot.status}
                      onChange={(e) => updateStatus(slot.id, e.target.value)}
                      className={`w-full appearance-none border rounded-xl px-3 py-2 text-sm font-bold cursor-pointer outline-none shadow-sm ${statusColors[slot.status]}`}
                    >
                      <option>Not Started</option>
                      <option>Awaiting</option>
                      <option>Ongoing</option>
                      <option>Completed</option>
                      <option>Missed</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-3 pointer-events-none opacity-50"
                    />
                  </div>

                  {slot.unbooked && (
                    <button className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 w-full justify-center">
                      <Trash2 size={14} /> Delete Slot
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* --- Sidebar Modals/Forms --- */}
          <div className="space-y-6">
            {/* Slot Creation */}
            <div className="glass-card p-5 rounded-2xl">
              <h3 className="font-bold text-emerald-950 mb-4 flex items-center gap-2 border-b border-emerald-900/10 pb-3">
                <Plus size={18} className="text-emerald-600" /> Create Inventory
              </h3>
              <div className="space-y-3">
                <div className="flex items-center bg-white border border-emerald-900/10 rounded-xl px-3 py-2">
                  <Calendar size={16} className="text-emerald-700 mr-2" />
                  <input
                    type="date"
                    className="w-full text-sm font-semibold bg-transparent outline-none text-emerald-950"
                    defaultValue="2026-06-18"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="time"
                    className="bg-white border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none text-emerald-950"
                    defaultValue="14:45"
                  />
                  <input
                    type="time"
                    className="bg-white border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none text-emerald-950"
                    defaultValue="15:00"
                  />
                </div>
                <select className="w-full bg-white border border-emerald-900/10 rounded-xl px-3 py-2 text-sm font-semibold outline-none text-emerald-950">
                  <option>Library</option>
                  <option>Computer Center</option>
                  <option>Online (G-Meet)</option>
                </select>

                <button
                  onClick={() => setIsReserved(!isReserved)}
                  className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${isReserved ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-emerald-900/10 text-emerald-950"}`}
                >
                  Reserved for my cohort?
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors ${isReserved ? "bg-emerald-500" : "bg-slate-200"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isReserved ? "left-4" : "left-0.5"}`}
                    ></div>
                  </div>
                </button>

                <button className="w-full bg-emerald-900 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md mt-2">
                  Generate Slot
                </button>
              </div>
            </div>

            {/* Blacklist Form */}
            <div className="bg-white border border-red-100 p-5 rounded-2xl shadow-sm">
              <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                <Ban size={18} className="text-red-600" /> Restrict Access
              </h3>
              <p className="text-xs font-medium text-red-800/60 mb-4 leading-relaxed">
                Applying a ban will instantly drop the student's booking
                privileges across the portal for exactly 18 hours.
              </p>
              <input
                type="text"
                placeholder="Enter PGP or PCOM ID"
                className="w-full bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none text-red-900 placeholder:text-red-300 mb-3"
              />
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-md">
                Apply 18-Hour Ban
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
