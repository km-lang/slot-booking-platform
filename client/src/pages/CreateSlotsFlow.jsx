import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Repeat, AlertTriangle, CheckCircle2, Users } from "lucide-react";
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
const SLOT_TYPES = [
  { value: "CV",          label: "CV/HR" },
  { value: "GD",          label: "Group Discussion" },
  { value: "STOCK_PITCH", label: "Stock Pitch" },
  { value: "CASE",        label: "Case Study" },
];
const MULTI_PARTICIPANT_TYPES = ["GD", "CASE"];
// Soft ceiling matching the server's CASE_DESCRIPTION_MAX_LENGTH — a plain
// character cap standing in for "~200 words" without parsing actual words.
const CASE_DESCRIPTION_MAX_LENGTH = 1600;
// Quick-fill shortcuts for the Ends field — not the only way to set it, the field
// itself (both Day and Time) is always directly editable.
const QUICK_DURATIONS_MIN = [60, 120, 180, 240];
// Day/Time inputs — Start Day, Start Time, End Day, End Time — sized 10% down
// from the app's standard field (px-3 py-3 / text-sm = 12px/12px/14px).
const COMPACT_FIELD_CLASS =
  "w-full min-w-0 bg-white border border-emerald-900/10 rounded-xl px-[10.8px] py-[10.8px] text-[12.6px] font-bold text-emerald-950 outline-none";

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
  const [endDate, setEndDate]         = useState(today);
  const [endTime, setEndTime]         = useState("16:00");
  const [slotType, setSlotType]       = useState("CV");
  const [capacity, setCapacity]       = useState(4); // GD/CASE only — participants per slot
  const [caseDescription, setCaseDescription] = useState(""); // CASE only
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
        if (d.endDate) setEndDate(d.endDate);
        if (d.endTime) setEndTime(d.endTime);
        if (d.slotType) setSlotType(d.slotType);
        if (d.capacity) setCapacity(d.capacity);
        if (typeof d.caseDescription === "string") setCaseDescription(d.caseDescription);
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
      startDate, startTime, endDate, endTime, slotType, capacity, caseDescription, slotDuration, isCustomDuration,
      selectedVenue, meetingLink, cohortOnly, publishNow, repeatWeekly, repeatDays, repeatUntil,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [startDate, startTime, endDate, endTime, slotType, capacity, caseDescription, slotDuration, isCustomDuration,
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
  // Block length comes straight from the explicit start/end date+time delta —
  // same calculation the original single-block form used — then that same
  // duration is replayed onto every generated date below for Repeat Weekly.
  const [startHour, startMin] = startTime.split(":").map(Number);
  const startDateTimeMs = new Date(`${startDate}T${startTime}:00`).getTime();
  const endDateTimeMs = new Date(`${endDate}T${endTime}:00`).getTime();
  const blockMinutes = Math.round((endDateTimeMs - startDateTimeMs) / 60000);
  const spansMidnight = endDate !== startDate;

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
      return { start, end: new Date(start.getTime() + blockMinutes * 60000) };
    }),
    [occurrenceDates, startHour, startMin, blockMinutes],
  );

  const perOccurrenceSlotCount = slotDuration > 0 ? Math.max(0, Math.floor(blockMinutes / slotDuration)) : 0;
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
        slotType,
        ...(MULTI_PARTICIPANT_TYPES.includes(slotType) && { capacity }),
        ...(slotType === "CASE" && caseDescription.trim() && { caseDescription: caseDescription.trim() }),
        ...(isOnlineVenue && meetingLink.trim() && { meetingLink: meetingLink.trim() }),
      },
      {
        onSuccess: (res) => {
          localStorage.removeItem(DRAFT_KEY);
          const skippedCount = res?.skipped?.length ?? 0;
          // Passed via navigation state rather than alert() — some in-app browsers
          // (WhatsApp, Instagram webviews) silently suppress window.alert(), which
          // would leave a mentor with skipped occurrences none the wiser (see
          // MentorDashboard's ConfirmDialog for the same root cause elsewhere).
          // MentorDashboard reads this on mount and shows it as a dismissible banner.
          const notice =
            skippedCount > 0 || conflictCount > 0
              ? `Created ${res.slotsCreated} slot${res.slotsCreated === 1 ? "" : "s"} across ${res.releaseIds.length} day${res.releaseIds.length === 1 ? "" : "s"}. ${skippedCount + conflictCount} occurrence${skippedCount + conflictCount === 1 ? "" : "s"} skipped due to overlap.`
              : null;
          navigate("/mentor", { state: notice ? { slotCreationNotice: notice } : undefined });
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
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase mb-1">Slot Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SLOT_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => {
                      setSlotType(t.value);
                      // GD always needs 2+; switching away from a 1-seat CASE slot
                      // must not carry an invalid capacity over to GD.
                      if (t.value === "GD") setCapacity((c) => Math.max(2, c));
                    }}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${slotType === t.value ? "bg-emerald-100 border-emerald-500 text-emerald-800" : "bg-white border-emerald-900/10 text-emerald-900/60 hover:bg-emerald-50"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {MULTI_PARTICIPANT_TYPES.includes(slotType) && (
                  <div className="mt-3 bg-white border border-emerald-900/10 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800/60 uppercase">
                        <Users size={12} /> Participants Per Slot
                      </label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setCapacity((c) => Math.max(slotType === "CASE" ? 1 : 2, c - 1))}
                          className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-sm">−</button>
                        <span className="w-6 text-center font-black text-emerald-950 text-sm">{capacity}</span>
                        <button type="button" onClick={() => setCapacity((c) => Math.min(30, c + 1))}
                          className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-sm">+</button>
                      </div>
                    </div>
                    {slotType === "CASE" && (
                      <p className="text-[10px] font-bold text-emerald-700/50 mt-2">
                        {capacity === 1
                          ? "1 Solver, no Shadow seats — a one-on-one Case session"
                          : `1 Solver + ${capacity - 1} Shadow${capacity - 1 !== 1 ? "s" : ""} — every Case slot requires exactly one Solver`}
                      </p>
                    )}
                  </div>
                )}
                {slotType === "CASE" && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-emerald-800/60 uppercase">
                        Case Description <span className="text-emerald-700/40 font-semibold normal-case">(optional — shown to students before they book)</span>
                      </label>
                      <span className={`text-[10px] font-bold ${caseDescription.length > CASE_DESCRIPTION_MAX_LENGTH ? "text-red-600" : "text-emerald-700/40"}`}>
                        {caseDescription.length}/{CASE_DESCRIPTION_MAX_LENGTH}
                      </span>
                    </div>
                    <textarea
                      value={caseDescription}
                      onChange={(e) => setCaseDescription(e.target.value)}
                      maxLength={CASE_DESCRIPTION_MAX_LENGTH}
                      rows={5}
                      placeholder="Briefly describe the case — industry, situation, what students should come prepared with…"
                      className="w-full bg-white border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-950 outline-none resize-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-emerald-800/60 uppercase mb-1">
                  {repeatWeekly ? "First Occurrence" : "Starts"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className={COMPACT_FIELD_CLASS} />
                    <p className="text-[10px] font-bold text-emerald-700/50 mt-1">{weekdayLong(startDate)}</p>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                    <TimeField value={startTime} onChange={setStartTime} className={COMPACT_FIELD_CLASS} />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-emerald-800/60 uppercase">Ends</p>
                  <div className="flex gap-1">
                    {QUICK_DURATIONS_MIN.map((mins) => (
                      <button key={mins} type="button"
                        onClick={() => {
                          const start = new Date(`${startDate}T${startTime}:00`);
                          const end = new Date(start.getTime() + mins * 60000);
                          setEndDate(toLocalYYYYMMDD(end));
                          setEndTime(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-900/10 text-emerald-700/70 hover:bg-emerald-50 hover:border-emerald-300 transition-colors">
                        +{mins / 60}h
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Day</label>
                    <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                      className={COMPACT_FIELD_CLASS} />
                    <p className="text-[10px] font-bold text-emerald-700/50 mt-1">{weekdayLong(endDate)}</p>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[9px] font-bold text-emerald-700/50 uppercase mb-1">Time</label>
                    <TimeField value={endTime} onChange={setEndTime} className={COMPACT_FIELD_CLASS} />
                  </div>
                </div>
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
                  <span className="text-xs font-bold text-red-600">
                    {blockMinutes <= 0 ? "End time must be after start time" : "Block length is shorter than one slot"}
                  </span>
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
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-emerald-700/60">Type</span>
                  <span className="font-bold text-emerald-950">
                    {SLOT_TYPES.find((t) => t.value === slotType)?.label}
                    {MULTI_PARTICIPANT_TYPES.includes(slotType) && ` · ${capacity} per slot`}
                  </span>
                </div>
                {slotType === "CASE" && caseDescription.trim() && (
                  <div className="text-xs">
                    <span className="font-semibold text-emerald-700/60 block mb-1">Case Description</span>
                    <p className="font-semibold text-emerald-950 bg-[var(--color-bg)] rounded-lg p-2.5 whitespace-pre-wrap">{caseDescription.trim()}</p>
                  </div>
                )}
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
                ) : startDate === endDate ? (
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
