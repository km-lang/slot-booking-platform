import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Download, AlertCircle, CheckCircle, Mail, XCircle, Loader2 } from "lucide-react";
import { useMentorCohort, useMenteeSummary, useExportCsv } from "../hooks/useApi";
import AppFooter from "../components/AppFooter";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Sheet from "../components/ui/Sheet";
import { SkeletonCard } from "../components/ui/Skeleton";

const SLOT_TYPE_LABELS = { CV: "CV Review", GD: "Group Discussion", CASE: "Case Study", STOCK_PITCH: "Stock Pitch" };

export default function MentorCohortDetails() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMentee, setSelectedMentee] = useState(null);
  // Cohort-level filter — one shared range for whichever mentee's summary you open,
  // not reset per mentee. Empty by default — all-time totals.
  const [summaryFrom, setSummaryFrom] = useState("");
  const [summaryTo, setSummaryTo] = useState("");

  const { data, isLoading, error } = useMentorCohort();
  const exportMutation = useExportCsv();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useMenteeSummary(selectedMentee?.id, summaryFrom, summaryTo);
  const cohort  = data?.cohort  ?? null;
  const members = data?.members ?? [];
  // Student detail summary (and its date filter) is Disha-only for now — not
  // extended to SIGFi (or any other AIG) cohorts.
  const isDisha = cohort?.aigSlug === "disha";

  const handleExport = () => {
    exportMutation.mutate(
      { path: "/cohort/export", filename: `cohort-${cohort?.label ?? "export"}.csv` },
      { onSettled: () => setTimeout(() => exportMutation.reset(), 2500) },
    );
  };

  const filteredMembers = searchQuery.trim()
    ? members.filter(
        (m) =>
          m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.pgp?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : members;

  const headerLabel = cohort
    ? `${cohort.label} · ${cohort.memberCount} Mentees`
    : isLoading
    ? "Loading…"
    : "Cohort Tracker";

  return (
    <AppShell
      maxWidthClassName="max-w-md md:max-w-2xl lg:max-w-4xl"
      header={
        <PageHeader
          title="Cohort Tracker"
          subtitle={headerLabel}
          onBack={() => navigate("/mentor")}
          actions={
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending || isLoading || !cohort}
              className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40"
              title={
                exportMutation.isPending ? "Exporting…"
                : exportMutation.isSuccess ? "Downloaded"
                : exportMutation.isError ? (exportMutation.error?.message ?? "Export failed")
                : "Download cohort CSV"
              }
            >
              {exportMutation.isPending ? <Loader2 size={16} className="animate-spin" />
                : exportMutation.isSuccess ? <CheckCircle size={16} className="text-emerald-600" />
                : exportMutation.isError ? <XCircle size={16} className="text-red-600" />
                : <Download size={16} />}
            </button>
          }
        />
      }
    >
        <main className="flex-1 px-4 py-6 overflow-y-auto">
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-3.5 text-emerald-900/40" />
            <input
              type="text"
              placeholder="Search cohort members…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-emerald-900/10 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm"
            />
          </div>

          {isDisha && (
            <div className="mb-6">
              <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-1.5">
                Mentee Summary Date Filter
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={summaryFrom}
                  max={summaryTo || undefined}
                  onChange={(e) => setSummaryFrom(e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-emerald-900/10 rounded-xl px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500 shadow-sm"
                />
                <span className="text-emerald-700/50 text-xs font-bold shrink-0">to</span>
                <input
                  type="date"
                  value={summaryTo}
                  min={summaryFrom || undefined}
                  onChange={(e) => setSummaryTo(e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-emerald-900/10 rounded-xl px-2.5 py-2 text-xs font-semibold outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
              {(summaryFrom || summaryTo) && (
                <button
                  type="button"
                  onClick={() => { setSummaryFrom(""); setSummaryTo(""); }}
                  className="text-[11px] font-bold text-emerald-700/60 hover:text-emerald-700 underline underline-offset-2 mt-1.5"
                >
                  Clear filter (show all-time)
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700 mb-4">
              {error.message}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
          <Card padding="p-0" className="overflow-hidden divide-y divide-emerald-900/5">
            {filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-emerald-800/40 text-sm font-bold">
                {searchQuery ? `No results for "${searchQuery}"` : "No cohort members found"}
              </div>
            ) : (
              filteredMembers.map((mentee) => {
                const isWarning = mentee.status === "Action Needed";
                const isReady   = mentee.status === "Reviewed";

                return (
                  <div key={mentee.id} className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        {isDisha ? (
                          <button
                            type="button"
                            onClick={() => setSelectedMentee(mentee)}
                            className="font-bold text-[15px] text-emerald-950 leading-tight text-left hover:text-emerald-700 hover:underline underline-offset-2 transition-colors"
                          >
                            {mentee.name}
                          </button>
                        ) : (
                          <h3 className="font-bold text-[15px] text-emerald-950 leading-tight">{mentee.name}</h3>
                        )}
                        <div className="text-[11px] font-bold text-emerald-700/60 mt-0.5">
                          {mentee.pgp}
                          {mentee.isBanned && (
                            <span className="ml-2 bg-red-100 text-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                              Banned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded border
                        ${isWarning ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isReady ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {isWarning && <AlertCircle size={10} />}
                        {isReady   && <CheckCircle size={10} />}
                        {mentee.status}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 bg-[var(--color-bg)] rounded-xl p-3 border border-emerald-900/5">
                      <div>
                        <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">Slots Taken</div>
                        <div className="font-black text-sm text-emerald-950">
                          {mentee.slotsTaken}{" "}
                          <span className="text-[10px] text-emerald-700/60 font-semibold">Sessions</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">Last Review</div>
                        <div className="font-black text-sm text-emerald-950">{mentee.lastReview}</div>
                      </div>
                    </div>

                    <a
                      href={`mailto:${mentee.email}`}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border
                        ${isWarning
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                          : "bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-200"}`}
                    >
                      <Mail size={14} />
                      {isWarning ? "Nudge Mentee" : "Message"}
                    </a>
                  </div>
                );
              })
            )}
          </Card>
          )}
          <AppFooter />
        </main>

        <Sheet isOpen={!!selectedMentee} onClose={() => setSelectedMentee(null)}>
          <h3 className="font-black text-lg text-emerald-950">{selectedMentee?.name}</h3>
          <div className="text-xs font-bold text-emerald-700/60">{selectedMentee?.pgp}</div>
          <div className="text-[11px] font-bold text-emerald-700/50 mb-4">
            {summaryFrom && summaryTo ? `${summaryFrom} to ${summaryTo}` : "All-time"}
          </div>

          {summaryLoading ? (
            <div className="text-sm text-emerald-800/50">Loading…</div>
          ) : summaryError ? (
            <div className="text-sm text-red-700">{summaryError.message}</div>
          ) : summary && (
            <div className="space-y-3">
              <div className="bg-[var(--color-bg)] rounded-xl p-3 border border-emerald-900/5">
                <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">Total Slots Taken</div>
                <div className="font-black text-lg text-emerald-950">{summary.totalSlots}</div>
              </div>
              <div className="bg-[var(--color-bg)] rounded-xl p-3 border border-emerald-900/5">
                <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-2">By Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(summary.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm font-bold text-emerald-950">
                      <span className="text-emerald-700/70">{SLOT_TYPE_LABELS[type] ?? type}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[var(--color-bg)] rounded-xl p-3 border border-emerald-900/5">
                <div className="text-[9px] font-bold text-emerald-800/50 uppercase tracking-widest mb-0.5">Total Hours</div>
                <div className="font-black text-lg text-emerald-950">{summary.totalHours}h</div>
              </div>
            </div>
          )}
        </Sheet>
    </AppShell>
  );
}
