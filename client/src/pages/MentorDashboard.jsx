import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Plus,
  Users,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Calendar,
  Video,
} from "lucide-react";

export default function MentorDashboard() {
  const navigate = useNavigate();
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [slotDuration, setSlotDuration] = useState(15); // Added state for duration

  // Prevent scrolling when sheet is open
  useEffect(() => {
    if (isCreateSheetOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isCreateSheetOpen]);

  // Mock Data
  const bookedSessions = [
    {
      id: 1,
      student: "Hrishikesh Kumar",
      pgp: "25110",
      time: "10:00 AM",
      venue: "Library",
      purpose: "Consulting CV",
    },
    {
      id: 2,
      student: "Dhriti Srivastava",
      pgp: "25089",
      time: "10:15 AM",
      venue: "Online",
      purpose: "Work Experience",
    },
  ];

  const availableSlots = [
    { id: 3, time: "11:00 - 11:15 AM", venue: "Library", reserved: true },
    { id: 4, time: "11:15 - 11:30 AM", venue: "Library", reserved: false },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-24 sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col overflow-hidden">
        {/* Header & Cohort Pulse */}
        <header className="bg-emerald-900 px-5 pt-4 pb-6 rounded-b-3xl shadow-lg relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-white font-bold">
              <Shield size={18} className="text-emerald-400" /> Mentor Console
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold border border-white/20">
              SJ
            </div>
          </div>

          {/* Cohort Pulse Summary */}
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-emerald-50 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} /> My Cohort (Q4)
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-white">12</div>
                <div className="text-[9px] text-emerald-200/80 font-bold uppercase mt-1">
                  Total Mentees
                </div>
              </div>
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-emerald-400">18</div>
                <div className="text-[9px] text-emerald-200/80 font-bold uppercase mt-1">
                  Total Slots Taken
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/mentor/cohort")}
              className="w-full bg-white/10 hover:bg-white/20 transition-colors py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-white border border-white/10"
            >
              View Cohort Details <ChevronRight size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 overflow-y-auto">
          {/* Quick Actions */}
          <div className="flex gap-3 mb-6">
            <button className="flex-1 bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors">
              <AlertTriangle size={14} className="text-amber-500" /> Running
              Late?
            </button>
            <button className="flex-1 bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors">
              <Calendar size={14} className="text-emerald-600" /> Sync Calendar
            </button>
          </div>

          {/* Booked Sessions List */}
          <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
            Today's Booked Sessions
          </h2>
          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-6">
            {bookedSessions.map((session) => (
              <div key={session.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-[15px] text-emerald-950">
                      {session.student}
                    </h3>
                    <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
                      PGP-{session.pgp}{" "}
                      <span className="text-emerald-900/20">|</span>{" "}
                      {session.purpose}
                    </p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-1 rounded">
                    {session.time}
                  </span>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-900/5">
                  <button className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                    <CheckCircle size={14} /> Attended
                  </button>
                  <button className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                    <XCircle size={14} /> No Show
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Available Slots List */}
          <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
            Unbooked Slots (Live)
          </h2>
          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-8">
            {availableSlots.map((slot) => (
              <div
                key={slot.id}
                className="p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-emerald-950 text-sm mb-1">
                    {slot.time}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-emerald-700/60">{slot.venue}</span>
                    {slot.reserved && (
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Cohort Only
                      </span>
                    )}
                  </div>
                </div>
                <button className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </main>

        {/* FAB: Open Create Sheet */}
        <button
          onClick={() => setIsCreateSheetOpen(true)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-900 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(6,45,28,0.3)] active:scale-95 transition-transform z-20"
        >
          <Plus size={24} />
        </button>

        {/* --- SLOT CREATION BOTTOM SHEET --- */}
        <div
          className={`absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40 transition-opacity duration-300
            ${isCreateSheetOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
          onClick={() => setIsCreateSheetOpen(false)}
        />

        <div
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isCreateSheetOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
          <h3 className="text-xl font-black text-emerald-950 mb-1">
            Release New Slots
          </h3>
          <p className="text-xs font-semibold text-emerald-700/70 mb-6">
            Create customized booking blocks.
          </p>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  defaultValue="14:00"
                  className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  defaultValue="15:00"
                  className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
            </div>

            {/* DURATION SELECTOR PILLS */}
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                Duration Per Slot
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30, 45].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSlotDuration(duration)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      slotDuration === duration
                        ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                        : "bg-[#F8FAF7] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"
                    }`}
                  >
                    {duration}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                Venue
              </label>
              <select className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none appearance-none">
                <option>Library (In-Person)</option>
                <option>Online (Google Meet)</option>
              </select>
            </div>

            {/* iOS Toggle for Cohort Reservation */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <div>
                <div className="text-sm font-bold text-emerald-950">
                  Reserve for Cohort
                </div>
                <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">
                  Only your mentees can book this block
                </div>
              </div>
              <div className="w-12 h-6 rounded-full bg-emerald-500 relative cursor-pointer">
                <div className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsCreateSheetOpen(false)}
            className="w-full bg-emerald-900 text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(6,45,28,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Generate Slots
          </button>
        </div>
      </div>
    </div>
  );
}
