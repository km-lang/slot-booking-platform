import React, { useState, useEffect } from "react";
import {
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  ChevronDown,
  User,
  AlertTriangle,
  Briefcase,
  Lock,
} from "lucide-react";

export default function StudentDashboard() {
  const [timeLeft, setTimeLeft] = useState(105);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Mock Data
  const slots = [
    {
      id: 1,
      mentor: "Dr. Evelyn Vance",
      role: "Faculty",
      time: "10:00 - 10:15 AM",
      venue: "Library",
      room: "Study Room B",
      isAvailable: true,
    },
    {
      id: 2,
      mentor: "Prof. Marcus Thorne",
      role: "Faculty",
      time: "10:15 - 10:30 AM",
      venue: "Online",
      isAvailable: true,
      delay: 10,
      reserved: "Q4",
    },
    {
      id: 3,
      mentor: "Priya Sharma",
      role: "Alumni",
      time: "11:00 - 11:15 AM",
      venue: "Online",
      isAvailable: true,
    },
    {
      id: 4,
      mentor: "Rahul Menon",
      role: "Faculty",
      time: "11:15 - 11:30 AM",
      venue: "CC",
      room: "Main Lab",
      isAvailable: false,
      bookedBy: "John Doe",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleSlot = (id) => {
    setSelectedSlots((prev) =>
      prev.includes(id)
        ? prev.filter((slotId) => slotId !== id)
        : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-20">
      {/* --- Top Navigation --- */}
      <nav className="sticky top-0 z-50 glass-panel px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3 font-bold text-lg text-emerald-950">
          <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400 shadow-md">
            <Briefcase size={18} />
          </div>
          <div>
            Team Disha{" "}
            <span className="text-emerald-700 text-sm font-semibold ml-1">
              Student Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white border border-emerald-900/10 rounded-full px-3 py-1.5 shadow-sm">
          <div className="text-xs text-right hidden sm:block">
            <div className="font-semibold text-emerald-950">
              Hrishikesh Kumar
            </div>
            <div className="text-emerald-700/70 font-medium">PGP 2025-2027</div>
          </div>
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
            <User size={14} className="text-emerald-800" />
          </div>
        </div>
      </nav>

      {/* --- Sticky Booking Action Header --- */}
      <div className="sticky top-[58px] z-40 bg-white/80 backdrop-blur-xl border-b border-emerald-900/10 px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200/60 rounded-xl px-4 py-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse-fast"></div>
          <div>
            <div className="text-[10px] text-amber-700 uppercase tracking-widest font-bold mb-0.5">
              Release window closes in
            </div>
            <div className="text-xl font-black text-amber-600 tabular-nums leading-none">
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        <button
          disabled={selectedSlots.length === 0}
          className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 
            ${
              selectedSlots.length > 0
                ? "bg-emerald-900 hover:bg-emerald-800 text-white shadow-[0_8px_20px_rgba(6,45,28,0.2)] active:scale-95"
                : "bg-emerald-900/5 text-emerald-900/30 cursor-not-allowed border border-emerald-900/10"
            }`}
        >
          <CheckCircle2 size={18} />
          Confirm {selectedSlots.length} Bookings
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* --- Summary KPI Bar --- */}
        <div className="flex flex-wrap items-center justify-between gap-6 bg-white border border-emerald-900/10 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-emerald-950 leading-none">
                12
              </span>
              <span className="text-[10px] font-bold text-emerald-800/50 uppercase tracking-widest mt-1.5">
                Available
              </span>
            </div>
            <div className="w-px h-8 bg-emerald-900/10"></div>
            <div className="flex flex-col">
              <span
                className={`text-2xl font-black leading-none ${selectedSlots.length > 0 ? "text-emerald-600" : "text-emerald-900/30"}`}
              >
                {selectedSlots.length}
              </span>
              <span className="text-[10px] font-bold text-emerald-800/50 uppercase tracking-widest mt-1.5">
                Selected
              </span>
            </div>
            <div className="w-px h-8 bg-emerald-900/10"></div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-emerald-900/30 leading-none">
                5
              </span>
              <span className="text-[10px] font-bold text-emerald-800/50 uppercase tracking-widest mt-1.5">
                Already Booked
              </span>
            </div>
          </div>
          <div className="hidden md:flex text-xs font-semibold text-emerald-700/60 items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
            <User size={14} /> ~600 students in this release
          </div>
        </div>

        <div className="mb-4 flex items-end justify-between">
          <h1 className="text-xl font-bold text-emerald-950 flex items-center gap-2">
            Today's Slots
            <span className="text-xs font-semibold bg-white border border-emerald-900/10 px-2 py-0.5 rounded text-emerald-700">
              June 18
            </span>
          </h1>
          <p className="text-xs font-semibold text-emerald-700/70 hidden sm:block">
            Select multiple slots to book concurrently.
          </p>
        </div>

        {/* --- Slot Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot) => {
            const isSelected = selectedSlots.includes(slot.id);

            return (
              <div
                key={slot.id}
                onClick={() => slot.isAvailable && toggleSlot(slot.id)}
                className={`
                  relative flex flex-col justify-between overflow-hidden rounded-2xl transition-all duration-200 p-5
                  ${slot.isAvailable ? "cursor-pointer hover:-translate-y-1" : "opacity-60 cursor-not-allowed bg-emerald-900/5 border border-emerald-900/10"}
                  ${
                    isSelected
                      ? "bg-emerald-50 border border-emerald-300 shadow-[0_8px_20px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/20"
                      : "bg-white border border-emerald-900/10 hover:shadow-md"
                  }
                `}
              >
                {/* Custom Checkbox Indicator */}
                {slot.isAvailable && (
                  <div
                    className={`absolute top-5 right-5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                    ${isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-emerald-900/20"}
                  `}
                  >
                    {isSelected && <CheckCircle2 size={14} strokeWidth={4} />}
                  </div>
                )}

                {!slot.isAvailable && (
                  <div className="absolute top-5 right-5">
                    <Lock size={18} className="text-emerald-900/30" />
                  </div>
                )}

                <div>
                  {/* Mentor Profile Header */}
                  <div className="flex items-center gap-3 mb-4 pr-8">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border 
                      ${slot.role === "Alumni" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-emerald-900 text-emerald-50 border-emerald-800"}`}
                    >
                      {slot.mentor
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-emerald-950 leading-tight">
                        {slot.mentor}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
                          {slot.role}
                        </span>
                        {slot.reserved && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded border border-amber-200 uppercase font-bold tracking-wider">
                            Reserved: Q4
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-emerald-800/80 mb-4">
                    <div className="flex items-center gap-1.5 bg-emerald-900/5 px-2 py-1 rounded-md">
                      <Clock size={13} className="text-emerald-600" />{" "}
                      {slot.time}
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-900/5 px-2 py-1 rounded-md">
                      {slot.venue === "Online" ? (
                        <Video size={13} className="text-emerald-600" />
                      ) : (
                        <MapPin size={13} className="text-emerald-600" />
                      )}
                      {slot.venue}
                      {slot.room && (
                        <span className="text-emerald-900/40 ml-1">
                          · {slot.room}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delay Warning */}
                  {slot.delay && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/60 text-amber-700 text-xs px-2.5 py-1.5 rounded-lg w-fit font-bold mb-2">
                      <AlertTriangle size={13} /> Running ~{slot.delay} mins
                      late
                    </div>
                  )}
                </div>

                {/* Conditional Footer (Dropdown or Status) */}
                <div className="mt-2 pt-4 border-t border-emerald-900/10 h-[68px] flex flex-col justify-end">
                  {slot.isAvailable ? (
                    <div
                      className={`transition-all duration-300 origin-top ${isSelected ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative">
                        <select className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-950 font-bold appearance-none focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer">
                          <option value="" disabled selected>
                            Select Purpose...
                          </option>
                          <option>Overall CV Review</option>
                          <option>Work Experience</option>
                          <option>POR / ECA</option>
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-2.5 text-emerald-800/50 pointer-events-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800/60 bg-white px-3 py-2 rounded-xl border border-emerald-900/5">
                      <User size={14} className="text-emerald-900/40" />
                      Booked by{" "}
                      <span className="text-emerald-950">{slot.bookedBy}</span>
                    </div>
                  )}

                  {slot.isAvailable && !isSelected && (
                    <div className="text-xs font-bold text-emerald-600 flex items-center justify-between w-full">
                      <span>Tap to select slot</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
