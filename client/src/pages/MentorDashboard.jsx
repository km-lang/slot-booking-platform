import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { apiFetch } from "../lib/apiClient";
import { useAuth } from "../context/useAuth";
import AvatarMenu from "../components/AvatarMenu";

const FOCUS_LABELS = {
  overall: "Overall CV Review",
  workex: "Work Experience",
  por: "POR / ECA",
};

export default function MentorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState({
    bookedSessions: [],
    availableSlots: [],
    cohortStats: { totalMentees: 0, totalSlotsTaken: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Slot creation form state
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [slotDuration, setSlotDuration] = useState(15);
  const [selectedVenue, setSelectedVenue] = useState("Library (In-Person)");
  const [cohortOnly, setCohortOnly] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const data = await apiFetch("/slots/mine");
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  useEffect(() => {
    if (isCreateSheetOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isCreateSheetOpen]);

  const handleAttendance = async (bookingId, status) => {
    try {
      await apiFetch(`/bookings/${bookingId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      await apiFetch(`/slots/${slotId}`, { method: "DELETE" });
      await fetchDashboardData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateSlots = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const startDateTime = new Date(`${slotDate}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${slotDate}T${endTime}:00`).toISOString();
      await apiFetch("/slots", {
        method: "POST",
        body: JSON.stringify({
          startTime: startDateTime,
          endTime: endDateTime,
          slotDuration,
          venue: selectedVenue,
          cohortOnly,
        }),
      });
      setIsCreateSheetOpen(false);
      await fetchDashboardData();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const { bookedSessions, availableSlots, cohortStats } = dashboardData;

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans pb-24 sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl relative flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-emerald-900 px-5 pt-4 pb-6 rounded-b-3xl shadow-lg relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2 text-white font-bold">
              <Shield size={18} className="text-emerald-400" /> Mentor Console
            </div>
            <button
              onClick={() => navigate("/")}
              className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-inner border border-emerald-800 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Shield size={12} className="text-emerald-400" />
              Shukracharya
            </button>
            <AvatarMenu variant="dark" />
          </div>

          {/* Cohort Pulse */}
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-emerald-50 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} /> My Cohort
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-white">
                  {loading ? "—" : cohortStats.totalMentees}
                </div>
                <div className="text-[9px] text-emerald-200/80 font-bold uppercase mt-1">
                  Total Mentees
                </div>
              </div>
              <div className="bg-black/20 rounded-xl p-3">
                <div className="text-2xl font-black text-emerald-400">
                  {loading ? "—" : cohortStats.totalSlotsTaken}
                </div>
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
          <div className="flex gap-3 mb-6">
            <button className="flex-1 bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors">
              <AlertTriangle size={14} className="text-amber-500" /> Running Late?
            </button>
            <button className="flex-1 bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors">
              <Calendar size={14} className="text-emerald-600" /> Sync Calendar
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs font-bold text-red-700">
              {error}
            </div>
          )}

          {/* Booked Sessions */}
          <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
            Today's Booked Sessions
          </h2>
          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-6">
            {loading ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
            ) : bookedSessions.length === 0 ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                No sessions booked for today
              </div>
            ) : (
              bookedSessions.map((session) => (
                <div key={session.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-[15px] text-emerald-950">
                        {session.student.name}
                      </h3>
                      <p className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
                        PGP-{session.student.pgp}{" "}
                        <span className="text-emerald-900/20">|</span>{" "}
                        {FOCUS_LABELS[session.student.purpose] ?? session.student.purpose}
                      </p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-1 rounded">
                      {session.time}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-900/5">
                    <button
                      onClick={() => handleAttendance(session.bookingId, "ATTENDED")}
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle size={14} /> Attended
                    </button>
                    <button
                      onClick={() => handleAttendance(session.bookingId, "NO_SHOW")}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <XCircle size={14} /> No Show
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Available Slots */}
          <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-2 px-1">
            Unbooked Slots (Live)
          </h2>
          <div className="bg-white border border-emerald-900/10 rounded-2xl shadow-sm overflow-hidden divide-y divide-emerald-900/5 mb-8">
            {loading ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">Loading…</div>
            ) : availableSlots.length === 0 ? (
              <div className="p-6 text-center text-emerald-800/40 text-xs font-bold">
                No unbooked slots — tap + to release some
              </div>
            ) : (
              availableSlots.map((slot) => (
                <div key={slot.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-950 text-sm mb-1">{slot.time}</div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-emerald-700/60">{slot.venue}</span>
                      {slot.cohortOnly && (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          Cohort Only
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </main>

        {/* FAB */}
        <button
          onClick={() => { setCreateError(null); setIsCreateSheetOpen(true); }}
          className="absolute bottom-6 right-6 w-14 h-14 bg-emerald-900 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(6,45,28,0.3)] active:scale-95 transition-transform z-20"
        >
          <Plus size={24} />
        </button>

        {/* Slot Creation Sheet Backdrop */}
        <div
          className={`absolute inset-0 bg-emerald-950/40 backdrop-blur-sm z-40 transition-opacity duration-300
            ${isCreateSheetOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
          onClick={() => !isCreating && setIsCreateSheetOpen(false)}
        />

        {/* Slot Creation Sheet */}
        <div
          className={`absolute bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 pb-8 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isCreateSheetOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <h3 className="text-xl font-black text-emerald-950 mb-1">Release New Slots</h3>
          <p className="text-xs font-semibold text-emerald-700/70 mb-6">
            Create customized booking blocks.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Date</label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                Duration Per Slot
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 20, 30, 45].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSlotDuration(d)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                      slotDuration === d
                        ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                        : "bg-[#F8FAF7] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Venue</label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none appearance-none"
              >
                <option>Library (In-Person)</option>
                <option>Online (Google Meet)</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <div>
                <div className="text-sm font-bold text-emerald-950">Reserve for Cohort</div>
                <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">
                  Only your mentees can book this block
                </div>
              </div>
              <div
                onClick={() => setCohortOnly(!cohortOnly)}
                className={`w-12 h-6 rounded-full ${cohortOnly ? "bg-emerald-500" : "bg-slate-300"} relative cursor-pointer transition-colors`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${cohortOnly ? "left-7" : "left-1"}`}
                />
              </div>
            </div>
          </div>

          {createError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-red-700">{createError}</p>
            </div>
          )}

          <button
            onClick={handleGenerateSlots}
            disabled={isCreating}
            className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(6,45,28,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={18} /> Generate Slots
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
