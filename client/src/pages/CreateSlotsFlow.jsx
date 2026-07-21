import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCreateSlots } from "../hooks/useApi";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Toggle from "../components/ui/Toggle";
import Button from "../components/ui/Button";
import { VENUE_OPTIONS, isOnlineVenue as checkIsOnlineVenue } from "../lib/venues";

const STEP_TITLES = ["Schedule", "Options & Review"];
const TOTAL_STEPS = STEP_TITLES.length;

export default function CreateSlotsFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Local calendar date, not toISOString()'s UTC one — IST is UTC+5:30, so between
  // 12:00 AM and 5:29 AM IST, toISOString().split("T")[0] would return yesterday's
  // date and silently default this form to the wrong day (see RescheduleSlot.jsx's
  // toLocalYYYYMMDD, which already avoids this for the same reason).
  const toLocalYYYYMMDD = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = toLocalYYYYMMDD(new Date());
  const [startDate, setStartDate]     = useState(today);
  const [startTime, setStartTime]     = useState("14:00");
  const [endDate, setEndDate]         = useState(today);
  const [endTime, setEndTime]         = useState("16:00");
  const [slotDuration, setSlotDuration] = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState("Library (In-Person)");
  const [meetingLink, setMeetingLink] = useState("");
  const [cohortOnly, setCohortOnly]   = useState(false);
  const [publishNow, setPublishNow]   = useState(true);

  const createSlotsMutation = useCreateSlots();

  // Live slot count calculation — start/end each carry their own day, so an
  // overnight range (e.g. 11:00 PM → 12:00 AM) is just two datetimes with the
  // end one a day later, not an ambiguous same-day wraparound. Guards against
  // 0/blank custom duration (would otherwise divide by zero and show an
  // "Infinity slots" preview).
  const startDateTimeMs = new Date(`${startDate}T${startTime}:00`).getTime();
  const endDateTimeMs   = new Date(`${endDate}T${endTime}:00`).getTime();
  const slotCount = slotDuration > 0
    ? Math.max(0, Math.floor((endDateTimeMs - startDateTimeMs) / 60000 / slotDuration))
    : 0;
  const isOnlineVenue = checkIsOnlineVenue(selectedVenue);

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigate("/mentor");
  };

  const handleGenerateSlots = () => {
    if (slotCount < 1) return;
    const startDateTime = new Date(startDateTimeMs).toISOString();
    const endDateTime   = new Date(endDateTimeMs).toISOString();
    createSlotsMutation.mutate(
      {
        startTime: startDateTime,
        endTime: endDateTime,
        slotDuration,
        venue: selectedVenue,
        cohortOnly,
        publish: publishNow,
        ...(isOnlineVenue && meetingLink.trim() && { meetingLink: meetingLink.trim() }),
      },
      { onSuccess: () => navigate("/mentor") },
    );
  };

  const isCreating = createSlotsMutation.isPending;
  const createError = createSlotsMutation.error?.message ?? null;

  const fmtTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  };
  // startDate/endDate are raw YYYY-MM-DD strings from <input type="date"> —
  // shown as dd-mm-yyyy instead of dumping the ISO string straight into the UI.
  const fmtDateDMY = (d) => {
    const [y, m, day] = d.split("-");
    return `${day}-${m}-${y}`;
  };

  return (
    <AppShell
      maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl"
      header={
        <PageHeader
          title="Release New Slots"
          subtitle={`Step ${step} of ${TOTAL_STEPS} · ${STEP_TITLES[step - 1]}`}
          onBack={handleBack}
        />
      }
    >
        <div className="flex items-center gap-1.5 px-4 pt-4">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-emerald-600" : "bg-emerald-900/10"}`}
            />
          ))}
        </div>

        <main className="flex-1 px-4 py-6 pb-safe-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Starts</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Ends</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                  </div>
                </div>
                {endDate !== startDate && (
                  <p className="text-[10px] font-bold text-emerald-700/50 mt-1.5">
                    Spans past midnight — ends the next day.
                  </p>
                )}
              </div>

              {slotCount > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">Preview</span>
                  <span className="text-sm font-black text-emerald-700">
                    {slotCount} slot{slotCount !== 1 ? "s" : ""} × {slotDuration}min each
                  </span>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <span className="text-xs font-bold text-red-600">End time must be after start time</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Duration Per Slot</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 20, 30].map((d) => (
                    <button key={d} type="button" onClick={() => { setIsCustomDuration(false); setSlotDuration(d); }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-colors ${!isCustomDuration && slotDuration === d ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-white border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                      {d}m
                    </button>
                  ))}
                  <button type="button" onClick={() => setIsCustomDuration(true)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-colors ${isCustomDuration ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-white border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                    Custom
                  </button>
                </div>
                {isCustomDuration && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" min="1" max="180" placeholder="Minutes per slot…"
                      value={slotDuration || ""}
                      onChange={(e) => setSlotDuration(Number(e.target.value))}
                      className="flex-1 bg-white border border-emerald-900/10 rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-950 outline-none"
                    />
                    <span className="text-xs font-bold text-emerald-700/60">minutes</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Venue</label>
                <select value={selectedVenue} onChange={(e) => setSelectedVenue(e.target.value)}
                  className="w-full bg-white border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none appearance-none">
                  {VENUE_OPTIONS.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>

              {isOnlineVenue && (
                <div>
                  <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                    Google Meet Link <span className="text-emerald-700/40 font-semibold normal-case">(optional — can add later)</span>
                  </label>
                  <input
                    type="url" placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
                    className="w-full bg-white border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-emerald-950">Reserve for Cohort</div>
                  <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">Only your mentees can book this block</div>
                </div>
                <Toggle checked={cohortOnly} onChange={setCohortOnly} />
              </div>

              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-emerald-950">Publish Immediately</div>
                  <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">
                    {publishNow ? "Visible and bookable as soon as it's created" : "Saved as a draft — publish later when ready"}
                  </div>
                </div>
                <Toggle checked={publishNow} onChange={setPublishNow} />
              </div>

              <div className="bg-white border border-emerald-900/10 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 mb-1">Review</p>
                {startDate === endDate ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Date</span>
                      <span className="font-bold text-emerald-950">{fmtDateDMY(startDate)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Time</span>
                      <span className="font-bold text-emerald-950">{fmtTime(startTime)} – {fmtTime(endTime)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Starts</span>
                      <span className="font-bold text-emerald-950">{fmtDateDMY(startDate)}, {fmtTime(startTime)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Ends</span>
                      <span className="font-bold text-emerald-950">{fmtDateDMY(endDate)}, {fmtTime(endTime)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-emerald-700/60">Slots</span>
                  <span className="font-bold text-emerald-950">{slotCount} × {slotDuration}min</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-emerald-700/60">Venue</span>
                  <span className="font-bold text-emerald-950">{selectedVenue}</span>
                </div>
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-700">{createError}</p>
                </div>
              )}
            </div>
          )}
        </main>

        <div className="px-4 pb-safe-6 pt-2">
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && slotCount < 1}
              className="w-full py-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
            >
              Continue
            </Button>
          ) : (
            <>
              <Button
                onClick={handleGenerateSlots}
                disabled={isCreating || slotCount < 1}
                loading={isCreating}
                className="w-full py-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
              >
                <Plus size={18} /> Create {slotCount > 0 ? `${slotCount} ` : ""}Slot{slotCount !== 1 ? "s" : ""}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={isCreating}
                className="w-full mt-2"
              >
                Back
              </Button>
            </>
          )}
        </div>
    </AppShell>
  );
}
