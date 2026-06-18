import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  ChevronDown,
  User,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

export default function MentorBookingView() {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(105);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // In reality, you would fetch slots based on mentorId.
  // We use mock data here based on your PRD constraints.
  const mentorName = mentorId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const slots = [
    {
      id: 1,
      time: "10:00 - 10:15 AM",
      venue: "Library",
      room: "Study Room B",
      isAvailable: true,
    },
    {
      id: 2,
      time: "10:15 - 10:30 AM",
      venue: "Online",
      isAvailable: true,
      delay: 10,
    },
    {
      id: 3,
      time: "10:30 - 10:45 AM",
      venue: "Online",
      isAvailable: false,
      bookedBy: "John Doe",
    },
  ];

  useEffect(() => {
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const toggleSlot = (id) =>
    setSelectedSlots((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id],
    );

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-20">
      {/* Sticky Header / Action Bar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-emerald-900/10 px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={() => navigate("/student")}
            className="p-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-lg leading-tight">{mentorName}</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Booking
              </span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                Closes in {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        <button
          disabled={selectedSlots.length === 0}
          className={`w-full sm:w-auto font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center gap-2 
            ${selectedSlots.length > 0 ? "bg-emerald-900 text-white shadow-lg active:scale-95" : "bg-emerald-900/5 text-emerald-900/30 cursor-not-allowed border border-emerald-900/10"}`}
        >
          <CheckCircle2 size={18} />
          Confirm {selectedSlots.length} Bookings
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot) => {
            const isSelected = selectedSlots.includes(slot.id);
            return (
              <div
                key={slot.id}
                onClick={() => slot.isAvailable && toggleSlot(slot.id)}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 transition-all
                  ${slot.isAvailable ? "cursor-pointer hover:-translate-y-1" : "opacity-60 cursor-not-allowed bg-emerald-900/5"}
                  ${isSelected ? "bg-emerald-50 border border-emerald-300 ring-1 ring-emerald-500/20" : "bg-white border border-emerald-900/10"}
                `}
              >
                {slot.isAvailable && (
                  <div
                    className={`absolute top-5 right-5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                    ${isSelected ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-emerald-900/20"}`}
                  >
                    {isSelected && <CheckCircle2 size={14} strokeWidth={4} />}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-emerald-800/80 mb-4 pr-8">
                    <div className="flex items-center gap-1.5 bg-emerald-900/5 px-2 py-1 rounded-md">
                      <Clock size={13} className="text-emerald-600" />{" "}
                      {slot.time}
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-900/5 px-2 py-1 rounded-md">
                      {slot.venue === "Online" ? (
                        <Video size={13} className="text-emerald-600" />
                      ) : (
                        <MapPin size={13} className="text-emerald-600" />
                      )}{" "}
                      {slot.venue}
                    </div>
                  </div>
                  {slot.delay && (
                    <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs px-2.5 py-1.5 rounded-lg w-fit font-bold mb-2">
                      <AlertTriangle size={13} /> Running ~{slot.delay} mins
                      late
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-4 border-t border-emerald-900/10 flex flex-col justify-end">
                  {slot.isAvailable ? (
                    <div
                      className={`transition-all duration-300 origin-top ${isSelected ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm text-emerald-950 font-bold outline-none shadow-sm cursor-pointer">
                        <option value="" disabled selected>
                          Select Purpose...
                        </option>
                        <option>Overall CV Review</option>
                        <option>Work Experience</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800/60">
                      <User size={14} /> Booked by {slot.bookedBy}
                    </div>
                  )}
                  {slot.isAvailable && !isSelected && (
                    <div className="text-xs font-bold text-emerald-600">
                      Tap to select slot
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
