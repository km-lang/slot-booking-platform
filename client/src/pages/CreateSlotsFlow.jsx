import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Repeat, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCreateSlots, useLastUsedSlotDefaults, useMyUpcomingSlotTimes } from "../hooks/useApi";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Toggle from "../components/ui/Toggle";
import Button from "../components/ui/Button";
import TimeField from "../components/ui/TimeField";
import { VENUE_OPTIONS, isOnlineVenue as checkIsOnlineVenue } from "../lib/venues";

const STEP_TITLES = ["Schedule", "Options & Review"];
const TOTAL_STEPS = STEP_TITLES.length;

// Local draft — survives an accidental back-nav or the app getting suspended
// mid-wizard, instead of silently resetting every field. Cleared on successful
// creation.
const DRAFT_KEY = "parthsaarthi:createSlotsDraft";
// Mirrors the server's cap (slotController.js) so the client warns before hitting
// the 400 instead of after.
const MAX_OCCURRENCES_PER_BATCH = 60;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Quick-fill shortcuts for the Ends field — not the only way to set it, the field
// itself is always directly typeable/editable.
const QUICK_DURATIONS_MIN = [60, 120, 180, 240];
const toMinutesOfDay = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

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
  const fourWeeksOut = () => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return toLocalYYYYMMDD(d);
  };

  const [startDate, setStartDate]     = useState(today);
  const [startTime, setStartTime]     = useState("14:00");
  const [endTime, setEndTime]         = useState("16:00");
  const [slotDuration, setSlotDuration]         = useState(30);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState(VENUE_OPTIONS[0]);
  const [meetingLink, setMeetingLink]     = useState("");
  const [cohortOnly, setCohortOnly]   = useState(false);
  const [publishNow, setPublishNow]   = useState(true);

  // Repeat weekly — off by default, matches the original single-block behavior.
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatDays, setRepeatDays]     = useState([]); // 0=Sun..6=Sat
  const [repeatUntil, setRepeatUntil]   = useState(fourWeeksOut());

  const createSlotsMutation = useCreateSlots();
  const { data: lastUsed }       = useLastUsedSlotDefaults();
  const { data: existingSlots = [] } = useMyUpcomingSlotTimes();

  // ── Draft restore + smart defaults ──────────────────────────────────────────
  // Priority: a restored draft (interrupted session) wins over the mentor's
  // last-used release settings, which win over the hardcoded fallback above.
  const hydratedRef = useRef(false);
  const draftRestoredRef = useRef(false);
  const defaultsAppliedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.startDate) setStartDate(d.startDate);
        if (d.startTime) setStartTime(d.startTime);
        if (d.endTime) setEndTime(d.endTime);
        if (d.slotDuration) setSlotDuration(d.slotDuration);
        if (typeof d.isCustomDuration === "boolean") setIsCustomDuration(d.isCustomDuration);
        if (d.selectedVenue) setSelectedVenue(d.selectedVenue);
        if (typeof d.meetingLink === "string") setMeetingLink(d.meetingLink);
        if (typeof d.cohortOnly === "boolean") setCohortOnly(d.cohortOnly);
        if (typeof d.publishNow === "boolean") setPublishNow(d.publishNow);
        if (typeof d.repeatWeekly === "boolean") setRepeatWeekly(d.repeatWeekly);
        if (Array.isArray(d.repeatDays)) setRepeatDays(d.repeatDays);
        if (d.repeatUntil) setRepeatUntil(d.repeatUntil);
        draftRestoredRef.current = true;
      }
    } catch {
      // Corrupt/foreign localStorage value — ignore and fall through to defaults.
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || draftRestoredRef.current || defaultsAppliedRef.current) return;
    if (!lastUsed?.found) return;
    setSelectedVenue(lastUsed.venue);
    setMeetingLink(lastUsed.meetingLink ?? "");
    if (lastUsed.slotDuration) setSlotDuration(lastUsed.slotDuration);
    setCohortOnly(Boolean(lastUsed.cohortOnly));
    defaultsAppliedRef.current = true;
  }, [lastUsed]);

  useEffect(() => {
    if (!hydratedRef.current) return; // don't stomp a draft mid-restore
    const draft = {
      startDate, startTime, endTime, slotDuration, isCustomDuration,
      selectedVenue, meetingLink, cohortOnly, publishNow, repeatWeekly, repeatDays, repeatUntil,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [startDate, startTime, endTime, slotDuration, isCustomDuration,
      selectedVenue, meetingLink, cohortOnly, publishNow, repeatWeekly, repeatDays, repeatUntil]);

  // First time Repeat Weekly is switched on, pre-check the start date's own
  // weekday instead of leaving the picker empty.
  useEffect(() => {
    if (repeatWeekly && repeatDays.length === 0) {
      setRepeatDays([new Date(`${startDate}T00:00:00`).getDay()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatWeekly]);

  const isOnlineVenue = checkIsOnlineVenue(selectedVenue);

  const toggleRepeatDay = (dow) => {
    setRepeatDays((prev) => (prev.includes(dow) ? prev.filter((x) => x !== dow) : [...prev, dow].sort()));
  };

  // ── Occurrence generation ───────────────────────────────────────────────────
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  // If the end clock-time is at or before the start clock-time, it's read as
  // crossing into the next day (e.g. 11:30 PM → 12:00 AM), same inference the
  // old separate end-date field made explicit.
  const spansMidnight = toMinutesOfDay(endTime) <= toMinutesOfDay(startTime);
  const blockMinutes = spansMidnight
    ? (24 * 60 - toMinutesOfDay(startTime)) + toMinutesOfDay(endTime)
    : toMinutesOfDay(endTime) - toMinutesOfDay(startTime);

  const occurrenceDates = useMemo(() => {
    const [y, m, d] = startDate.split("-").map(Number);
    const first = new Date(y, m - 1, d);
    if (!repeatWeekly) return [first];
    if (repeatDays.length === 0) return [];
    const [uy, um, ud] = (repeatUntil || startDate).split("-").map(Number);
    const until = new Date(uy, um - 1, ud);
    if (until < first) return [];
    const dates = [];
    for (const cur = new Date(first); cur <= until && dates.length < MAX_OCCURRENCES_PER_BATCH; cur.setDate(cur.getDate() + 1)) {
      if (repeatDays.includes(cur.getDay())) dates.push(new Date(cur));
    }
    return dates;
  }, [startDate, repeatWeekly, repeatUntil, repeatDays]);

  const occurrences = useMemo(
    () => occurrenceDates.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMin);
      let end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, endMin);
      if (spansMidnight) end = new Date(end.getTime() + 24 * 60 * 60000);
      return { start, end };
    }),
    [occurrenceDates, startHour, startMin, endHour, endMin, spansMidnight],
  );

  const perOccurrenceSlotCount = slotDuration > 0 ? Math.floor(blockMinutes / slotDuration) : 0;
  const totalSlotCount = perOccurrenceSlotCount * occurrences.length;
  const hitOccurrenceCap = repeatWeekly && occurrenceDates.length === MAX_OCCURRENCES_PER_BATCH;

  // ── Conflict preview — flags occurrences that overlap a slot the mentor
  // already has, so it's visible before submit instead of only as a 409 after.
  const conflictFlags = useMemo(
    () => occurrences.map((occ) =>
      existingSlots.some((e) => {
        const es = new Date(e.startTime).getTime();
        const ee = new Date(e.endTime).getTime();
        return occ.start.getTime() < ee && occ.end.getTime() > es;
      }),
    ),
    [occurrences, existingSlots],
  );
  const conflictCount = conflictFlags.filter(Boolean).length;
  const submittableOccurrences = occurrences.filter((_, i) => !conflictFlags[i]);
  const submittableSlotCount = perOccurrenceSlotCount * submittableOccurrences.length;

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else navigate("/mentor");
  };

  const handleGenerateSlots = () => {
    if (submittableOccurrences.length === 0 || perOccurrenceSlotCount < 1) return;
    createSlotsMutation.mutate(
      {
        occurrences: submittableOccurrences.map((o) => ({
          startTime: o.start.toISOString(),
          endTime: o.end.toISOString(),
        })),
        slotDuration,
        venue: selectedVenue,
        cohortOnly,
        publish: publishNow,
        ...(isOnlineVenue && meetingLink.trim() && { meetingLink: meetingLink.trim() }),
      },
      {
        onSuccess: (res) => {
          localStorage.removeItem(DRAFT_KEY);
          const skippedCount = res?.skipped?.length ?? 0;
          if (skippedCount > 0 || conflictCount > 0) {
            const totalSkipped = skippedCount + conflictCount;
            alert(`Created ${res.slotsCreated} slot${res.slotsCreated === 1 ? "" : "s"} across ${res.releaseIds.length} day${res.releaseIds.length === 1 ? "" : "s"}. ${totalSkipped} occurrence${totalSkipped === 1 ? "" : "s"} skipped due to overlap.`);
          }
          navigate("/mentor");
        },
      },
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
  const weekdayLong = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  const fmtOccDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const fmtOccTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

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
                <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  {repeatWeekly ? "First Occurrence" : "Starts"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                    <p className="text-[10px] font-bold text-emerald-700/50 mt-1">{weekdayLong(startDate)}</p>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                    <TimeField value={startTime} onChange={setStartTime}
                      className="w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-emerald-800/60 uppercase">Ends</label>
                  <div className="flex gap-1">
                    {QUICK_DURATIONS_MIN.map((mins) => (
                      <button key={mins} type="button"
                        onClick={() => {
                          const total = (toMinutesOfDay(startTime) + mins) % (24 * 60);
                          setEndTime(`${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-900/10 text-emerald-700/70 hover:bg-emerald-50 hover:border-emerald-300 transition-colors">
                        +{mins / 60}h
                      </button>
                    ))}
                  </div>
                </div>
                <TimeField value={endTime} onChange={setEndTime}
                  className="w-full bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                {spansMidnight && (
                  <p className="text-[10px] font-bold text-emerald-700/50 mt-1.5">
                    Spans past midnight — ends the next day.
                  </p>
                )}
              </div>

              {perOccurrenceSlotCount > 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">Preview</span>
                  <span className="text-sm font-black text-emerald-700">
                    {repeatWeekly
                      ? `${occurrences.length} day${occurrences.length !== 1 ? "s" : ""} × ${perOccurrenceSlotCount} = ${totalSlotCount} slots`
                      : `${perOccurrenceSlotCount} slot${perOccurrenceSlotCount !== 1 ? "s" : ""} × ${slotDuration}min each`}
                  </span>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <span className="text-xs font-bold text-red-600">Block length is shorter than one slot</span>
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

              <div className="bg-white border border-emerald-900/10 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat size={15} className="text-emerald-700" />
                    <div>
                      <div className="text-sm font-bold text-emerald-950">Repeat Weekly</div>
                      <div className="text-[10px] font-bold text-emerald-700/60 mt-0.5">
                        Release the same time block on chosen weekdays, over several weeks
                      </div>
                    </div>
                  </div>
                  <Toggle checked={repeatWeekly} onChange={setRepeatWeekly} />
                </div>

                {repeatWeekly && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1.5">Repeat On</label>
                      <div className="grid grid-cols-7 gap-1.5">
                        {WEEKDAY_LABELS.map((label, dow) => (
                          <button key={dow} type="button" onClick={() => toggleRepeatDay(dow)}
                            className={`py-2 rounded-lg text-[11px] font-bold border transition-colors ${repeatDays.includes(dow) ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-[var(--color-bg)] border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                            {label[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Repeat Until</label>
                      <input type="date" value={repeatUntil} min={startDate} onChange={(e) => setRepeatUntil(e.target.value)}
                        className="w-full bg-white border border-emerald-900/10 rounded-xl px-3 py-3 text-sm font-bold text-emerald-950 outline-none" />
                    </div>
                    {repeatDays.length === 0 ? (
                      <p className="text-[10px] font-bold text-red-600">Pick at least one weekday to repeat on</p>
                    ) : occurrences.length === 0 ? (
                      <p className="text-[10px] font-bold text-red-600">"Repeat Until" is before the first occurrence</p>
                    ) : (
                      <p className="text-[10px] font-bold text-emerald-700/50">
                        Creates {occurrences.length} release{occurrences.length !== 1 ? "s" : ""} — one per matching day
                        {hitOccurrenceCap ? " (capped at 60 — narrow the range for more)" : ""}
                      </p>
                    )}
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
                {repeatWeekly ? (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Repeats</span>
                      <span className="font-bold text-emerald-950 text-right">
                        {repeatDays.map((d) => WEEKDAY_LABELS[d]).join(", ") || "—"} until {fmtDateDMY(repeatUntil)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-emerald-700/60">Time</span>
                      <span className="font-bold text-emerald-950">{fmtTime(startTime)} – {fmtTime(endTime)}</span>
                    </div>
                  </>
                ) : (
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
                )}
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-emerald-700/60">Slots</span>
                  <span className="font-bold text-emerald-950">
                    {occurrences.length} day{occurrences.length !== 1 ? "s" : ""} × {perOccurrenceSlotCount} = {totalSlotCount}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-emerald-700/60">Venue</span>
                  <span className="font-bold text-emerald-950">{selectedVenue}</span>
                </div>
              </div>

              {occurrences.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50">
                      {repeatWeekly ? "Occurrences" : "This Slot"}
                    </p>
                    {conflictCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <AlertTriangle size={11} /> {conflictCount} will be skipped
                      </span>
                    )}
                  </div>
                  <div className="border border-emerald-900/10 rounded-xl max-h-56 overflow-y-auto divide-y divide-emerald-900/5">
                    {occurrences.map((occ, i) => {
                      const conflicted = conflictFlags[i];
                      return (
                        <div key={i} className={`px-3 py-2 flex items-center justify-between text-xs ${conflicted ? "bg-amber-50" : ""}`}>
                          <span className={`font-bold ${conflicted ? "text-amber-800" : "text-emerald-950"}`}>
                            {fmtOccDate(occ.start)} · {fmtOccTime(occ.start)}
                          </span>
                          {conflicted ? (
                            <span className="flex items-center gap-1 text-amber-700 font-bold text-[10px]">
                              <AlertTriangle size={11} /> Overlaps existing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                              <CheckCircle2 size={11} /> OK
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
              disabled={step === 1 && (perOccurrenceSlotCount < 1 || occurrences.length === 0)}
              className="w-full py-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
            >
              Continue
            </Button>
          ) : (
            <>
              <Button
                onClick={handleGenerateSlots}
                disabled={isCreating || submittableOccurrences.length === 0 || perOccurrenceSlotCount < 1}
                loading={isCreating}
                className="w-full py-4 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
              >
                <Plus size={18} /> Create {submittableSlotCount > 0 ? `${submittableSlotCount} ` : ""}Slot{submittableSlotCount !== 1 ? "s" : ""}
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
