import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  MapPin,
  Video,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  XCircle,
  Timer,
} from "lucide-react";

export default function MentorBookingView() {
  const { group, mentorId } = useParams();
  const navigate = useNavigate();

  // Sheet State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sheetMode, setSheetMode] = useState("BOOK"); // "BOOK" | "CANCEL"
  const [purpose, setPurpose] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Clean up mentorId
  const mentorName = mentorId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Mock Slots with the new BOOKED_BY_ME state
  const slots = [
    {
      id: "s1",
      time: "10:00 - 10:15 AM",
      venue: "Library",
      status: "AVAILABLE",
    },
    {
      id: "s2",
      time: "10:15 - 10:30 AM",
      venue: "Online (G-Meet)",
      status: "AVAILABLE",
      delay: 10,
    },
    {
      id: "s3",
      time: "10:30 - 10:45 AM",
      venue: "Online (G-Meet)",
      status: "BOOKED_BY_OTHER",
    },
    // Mocking a slot the user just booked 5 mins ago
    {
      id: "s4",
      time: "11:00 - 11:15 AM",
      venue: "Library",
      status: "BOOKED_BY_ME",
      focus: "Overall CV",
      cancelMinutesLeft: 10,
    },
  ];

  // Prevent scrolling when bottom sheet is open
  useEffect(() => {
    if (selectedSlot) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedSlot]);

  const openSheet = (slot, mode) => {
    setSelectedSlot(slot);
    setSheetMode(mode);
    setPurpose("");
  };

  const handleAction = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSelectedSlot(null);
      // In reality, this would trigger a re-fetch of the slots
      alert(
        sheetMode === "BOOK"
          ? "Slot Booked Successfully!"
          : "Booking Cancelled.",
      );
      if (sheetMode === "CANCEL") navigate("/student"); // Route back to dashboard on cancel
    }, 800);
  };

  return (
    <div className="h-full flex flex-col relative px-4">
      {/* iOS-Style Centered Profile Header */}
      <div className="flex flex-col items-center text-center py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center font-black text-3xl text-emerald-800 border-4 border-[#F8FAF7] shadow-lg">
            {mentorName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-2 border-[#F8FAF7] flex items-center justify-center animate-pulse"></div>
        </div>

        <h2 className="text-2xl font-black text-emerald-950 leading-tight">
          {mentorName}
        </h2>
        <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest mt-1">
          {group.toUpperCase()} MENTOR
        </p>
      </div>

      {/* Unified iOS-Style Slots List */}
      <div className="pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <h3 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
          Available Sessions
        </h3>

        <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5">
          {slots.map((slot) => {
            const isMine = slot.status === "BOOKED_BY_ME";
            const isAvailable = slot.status === "AVAILABLE";

            return (
              <div
                key={slot.id}
                className={`w-full p-4 flex items-center justify-between gap-4 transition-colors relative
                ${isMine ? "bg-emerald-50/50" : !isAvailable ? "bg-slate-50/50 opacity-60" : "hover:bg-emerald-50/30"}`}
              >
                {/* Active Booking Highlight */}
                {isMine && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                )}

                <div className="flex-1">
                  <div
                    className={`font-bold text-[16px] mb-1 ${isMine ? "text-emerald-700" : "text-emerald-950"}`}
                  >
                    {slot.time}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-800/60">
                    <span className="flex items-center gap-1">
                      {slot.venue.includes("Online") ? (
                        <Video size={12} />
                      ) : (
                        <MapPin size={12} />
                      )}
                      {slot.venue}
                    </span>
                    {isMine && (
                      <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] uppercase">
                        {slot.focus}
                      </span>
                    )}
                  </div>
                  {slot.delay && isAvailable && (
                    <div className="text-[10px] font-bold text-amber-700 mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={10} /> Running ~{slot.delay}m late
                    </div>
                  )}
                </div>

                {/* Status / Action Buttons */}
                <div className="shrink-0">
                  {isAvailable && (
                    <button
                      onClick={() => openSheet(slot, "BOOK")}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-4 py-2 rounded-xl transition-colors"
                    >
                      Book
                    </button>
                  )}
                  {isMine && (
                    <button
                      onClick={() => openSheet(slot, "CANCEL")}
                      className="flex flex-col items-end gap-1 group"
                    >
                      <span className="text-xs font-bold text-red-600 bg-red-50 group-hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        Cancel <XCircle size={12} />
                      </span>
                      <span className="text-[9px] font-bold text-red-800/50 flex items-center gap-0.5">
                        <Timer size={9} /> {slot.cancelMinutesLeft}m left
                      </span>
                    </button>
                  )}
                  {slot.status === "BOOKED_BY_OTHER" && (
                    <div className="text-[10px] font-bold text-emerald-900/30 uppercase tracking-widest px-2">
                      Booked
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- UNIFIED BOTTOM SHEET (Handles both Booking and Cancelling) --- */}

      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40 transition-opacity duration-300 rounded-lg
          ${selectedSlot ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={() => !isProcessing && setSelectedSlot(null)}
      />

      {/* Sheet Content */}
      <div
        className={`absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${selectedSlot ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>

        {selectedSlot && (
          <div>
            <h3 className="text-xl font-black text-emerald-950 mb-1">
              {sheetMode === "BOOK" ? "Confirm Session" : "Cancel Session"}
            </h3>
            <p className="text-sm font-semibold text-emerald-700/70 mb-6">
              with {mentorName}
            </p>

            {/* Slot Details Box */}
            <div
              className={`border rounded-2xl p-4 mb-6 ${sheetMode === "BOOK" ? "bg-[#F8FAF7] border-emerald-900/10" : "bg-red-50/50 border-red-100"}`}
            >
              <div
                className={`flex items-center gap-3 mb-3 pb-3 border-b ${sheetMode === "BOOK" ? "border-emerald-900/5" : "border-red-900/5"}`}
              >
                <Clock
                  className={
                    sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"
                  }
                  size={18}
                />
                <span className="font-bold text-emerald-950">
                  {selectedSlot.time}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedSlot.venue.includes("Online") ? (
                  <Video
                    className={
                      sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"
                    }
                    size={18}
                  />
                ) : (
                  <MapPin
                    className={
                      sheetMode === "BOOK" ? "text-emerald-600" : "text-red-500"
                    }
                    size={18}
                  />
                )}
                <span className="font-semibold text-emerald-800/80">
                  {selectedSlot.venue}
                </span>
              </div>
            </div>

            {/* BOOKING MODE SPECIFICS */}
            {sheetMode === "BOOK" && (
              <>
                <div className="mb-6">
                  <label className="block text-[11px] font-bold text-emerald-800/60 uppercase tracking-widest mb-2">
                    Session Focus (Required)
                  </label>
                  <div className="relative">
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500 shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="" disabled>
                        Select your focus...
                      </option>
                      <option value="overall">Overall CV Review</option>
                      <option value="workex">
                        Work Experience Optimization
                      </option>
                      <option value="por">POR / ECA Formatting</option>
                    </select>
                    <ChevronDown
                      size={18}
                      className="absolute right-4 top-3 text-emerald-900/30 pointer-events-none"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl mb-6">
                  <AlertTriangle
                    size={16}
                    className="text-red-500 shrink-0 mt-0.5"
                  />
                  <p className="text-[11px] font-bold text-red-900/80 leading-tight">
                    You can cancel within 15 mins of booking. Afterwards,
                    no-shows result in a 24-hr ban.
                  </p>
                </div>
              </>
            )}

            {/* CANCEL MODE SPECIFICS */}
            {sheetMode === "CANCEL" && (
              <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl mb-6 border border-amber-200/50">
                <AlertTriangle
                  size={16}
                  className="text-amber-500 shrink-0 mt-0.5"
                />
                <p className="text-[11px] font-bold text-amber-900/80 leading-tight">
                  Are you sure? This slot will immediately become available to
                  the rest of the batch.
                </p>
              </div>
            )}

            {/* Dynamic Action Button */}
            <button
              disabled={(sheetMode === "BOOK" && !purpose) || isProcessing}
              onClick={handleAction}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-200
                ${
                  isProcessing || (sheetMode === "BOOK" && !purpose)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : sheetMode === "BOOK"
                      ? "bg-emerald-900 text-white shadow-[0_8px_20px_rgba(6,45,28,0.2)] active:scale-95"
                      : "bg-red-600 text-white shadow-[0_8px_20px_rgba(220,38,38,0.2)] active:scale-95"
                }`}
            >
              {isProcessing ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  {sheetMode === "BOOK" ? (
                    <ShieldCheck size={18} />
                  ) : (
                    <XCircle size={18} />
                  )}
                  {sheetMode === "BOOK"
                    ? "Lock In Booking"
                    : "Confirm Cancellation"}
                </>
              )}
            </button>

            <button
              disabled={isProcessing}
              onClick={() => setSelectedSlot(null)}
              className="w-full py-3 mt-2 text-sm font-bold text-emerald-800/60 hover:text-emerald-950 transition-colors"
            >
              {sheetMode === "BOOK" ? "Cancel" : "Keep My Booking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
