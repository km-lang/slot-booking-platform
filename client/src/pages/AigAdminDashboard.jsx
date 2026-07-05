import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, Clock, AlertTriangle, CheckCircle, Search, Mail, Bell, ChevronRight, Download, XCircle, Loader2 } from "lucide-react";
import { useAigOverview, useExportCsv } from "../hooks/useApi";
import AvatarMenu from "../components/AvatarMenu";
import AppFooter from "../components/AppFooter";
import CollapsibleSection from "../components/CollapsibleSection";
import AppShell from "../components/ui/AppShell";
import Card from "../components/ui/Card";
import { SkeletonCard } from "../components/ui/Skeleton";

const getCountdown = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline) - Date.now();
  if (diff <= 0) return "Deadline has passed";
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days} Day${days !== 1 ? "s" : ""}, ${hours} Hr${hours !== 1 ? "s" : ""}`;
};

export default function AigAdminDashboard() {
  const { aigSlug } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const interventionRef = React.useRef(null);

  const { data, isLoading, error } = useAigOverview(aigSlug);
  const exportMutation = useExportCsv();

  const aigName =
    data?.aigName ??
    aigSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const handleExport = () => {
    exportMutation.mutate(
      { path: `/admin/aig/${aigSlug}/export`, filename: `aig-${aigSlug}-roster.csv` },
      { onSettled: () => setTimeout(() => exportMutation.reset(), 2500) },
    );
  };

  const filteredCohorts = (data?.cohorts ?? []).filter(
    (c) =>
      !searchQuery.trim() ||
      c.mentorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const countdown = data?.cvFreezeDeadline ? getCountdown(data.cvFreezeDeadline) : null;
  const { pct = 0, cleared = 0, total = 0 } = data?.batchReadiness ?? {};
  const atRisk = data?.atRiskStudents ?? [];

  return (
    <AppShell
      maxWidthClassName="max-w-md md:max-w-4xl"
      header={
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-emerald-900/10 px-4 py-4">
          <div className="flex justify-between items-center gap-3 mb-4">
            <div className="flex items-center gap-2 font-bold text-emerald-950 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400 shrink-0">
                <Shield size={18} />
              </div>
              <div className="min-w-0">
                <span className="block leading-tight">{aigName}</span>
                <span className="text-[10px] uppercase tracking-widest text-emerald-600 block leading-none mt-0.5">
                  Cohort Control
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExport}
                disabled={exportMutation.isPending || isLoading}
                className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-40"
                title={
                  exportMutation.isPending ? "Exporting…"
                  : exportMutation.isSuccess ? "Downloaded"
                  : exportMutation.isError ? (exportMutation.error?.message ?? "Export failed")
                  : "Export roster CSV"
                }
              >
                {exportMutation.isPending ? <Loader2 size={16} className="animate-spin" />
                  : exportMutation.isSuccess ? <CheckCircle size={16} className="text-emerald-600" />
                  : exportMutation.isError ? <XCircle size={16} className="text-red-600" />
                  : <Download size={16} />}
              </button>
              <button
                onClick={() => interventionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="relative w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title={atRisk.length > 0 ? `${atRisk.length} students need intervention` : "No interventions needed"}
              >
                <Bell size={16} />
                {atRisk.length > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />
                )}
              </button>
              <AvatarMenu />
            </div>
          </div>

          {/* CV Freeze Countdown */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-red-800 mb-0.5">
                Master CV Freeze
              </h2>
              <div className="text-sm font-bold text-red-950">
                {isLoading ? "—" : countdown
                  ? <>Ends in <span className="text-red-600">{countdown}</span></>
                  : "No deadline configured"}
              </div>
            </div>
          </div>
        </header>
      }
    >
        <main className="px-4 py-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-bold text-red-700 mb-6">
              {error.message}
            </div>
          )}

          {/* Batch Readiness */}
          <section className="mb-8">
            <div className="flex justify-between items-end mb-3">
              <h2 className="text-lg font-black text-emerald-950">Batch Readiness</h2>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">PGP1 2026</span>
            </div>
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl font-black text-emerald-950">{isLoading ? "—" : `${pct}%`}</span>
                <span className="text-xs font-bold text-emerald-700/60">
                  {isLoading ? "Loading…" : `${cleared} / ${total} Reviewed`}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </Card>
          </section>

          {/* Intervention Required */}
          {(isLoading || atRisk.length > 0) && (
            <section className="mb-8" ref={interventionRef}>
              <CollapsibleSection
                title={
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" /> Intervention Required
                  </span>
                }
                count={atRisk.length}
                badgeClassName="bg-amber-100 text-amber-700"
              >
                {isLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((i) => <SkeletonCard key={i} padding="p-4" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Distinct amber border (not the standard Card recipe) is a
                        deliberate semantic cue — this list is specifically urgent. */}
                    {atRisk.map((student, idx) => (
                      <div key={idx} className="bg-white border border-amber-200/60 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-[14px] text-emerald-950 leading-tight">{student.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-amber-50 text-amber-800 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-amber-200/50">
                              {student.reason}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700/60">{student.cohortLabel}</span>
                            {student.daysRemaining !== null && (
                              <span className="text-[10px] font-bold text-red-600">{student.daysRemaining}d left</span>
                            )}
                          </div>
                        </div>
                        <a
                          href={`mailto:${student.email}`}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors border border-emerald-200 shrink-0"
                        >
                          <Mail size={16} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            </section>
          )}

          {/* Cohort Drilldown */}
          <section>
            <h2 className="text-lg font-black text-emerald-950 mb-4">Cohort Drilldown</h2>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-3 text-emerald-900/40" />
              <input
                type="text"
                placeholder="Search cohort or mentor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-emerald-900/10 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 shadow-sm"
              />
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[0, 1].map((i) => <SkeletonCard key={i} padding="p-4" />)}
              </div>
            ) : filteredCohorts.length === 0 ? (
              <div className="text-xs font-bold text-emerald-800/40 px-1">
                {(data?.cohorts?.length ?? 0) === 0
                  ? "No cohorts configured for this AIG yet"
                  : `No match for "${searchQuery}"`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCohorts.map((cohort) => {
                  const canDrill = !!cohort.mentorSlug;
                  return (
                    <Card
                      key={cohort.id}
                      padding="p-4"
                      className={`transition-shadow ${canDrill ? "cursor-pointer hover:shadow-md hover:border-emerald-400/40" : ""}`}
                      onClick={() => canDrill && navigate(`/admin/${aigSlug}/mentor/${cohort.mentorSlug}`)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-black text-emerald-800 border border-emerald-200 text-xs">
                            {cohort.label.replace("Cohort ", "")}
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">{cohort.mentorName}</div>
                            <div className="font-bold text-sm text-emerald-950">{cohort.reviewed} / {cohort.total} Reviewed</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {cohort.status === "Completed" && <CheckCircle size={18} className="text-emerald-500" />}
                          {cohort.status === "Critical"  && <AlertTriangle size={18} className="text-red-500" />}
                          {canDrill && <ChevronRight size={16} className="text-emerald-400" />}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cohort.status === "Critical" ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${cohort.total > 0 ? Math.round((cohort.reviewed / cohort.total) * 100) : 0}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
          <AppFooter />
        </main>
    </AppShell>
  );
}
