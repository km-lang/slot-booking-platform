import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Save, CheckCircle } from "lucide-react";
import { useProfile, useUpdateProfile } from "../hooks/useApi";
import { useAuth } from "../context/useAuth";
import AppFooter from "../components/AppFooter";

export default function ProfileSettings() {
  const navigate    = useNavigate();
  const { updateUser } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const mutation    = useUpdateProfile();

  const [firm,   setFirm]   = useState("");
  const [domain, setDomain] = useState("");
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (profile) {
      setFirm(profile.firm ?? "");
      setDomain(profile.domain ?? "");
    }
  }, [profile]);

  const isMentor = profile?.role === "MENTOR";

  const handleSave = (e) => {
    e.preventDefault();
    const body = {};
    if (isMentor) {
      if (firm.trim())   body.firm   = firm.trim();
      if (domain.trim()) body.domain = domain.trim();
    }
    mutation.mutate(body, {
      onSuccess: (updated) => {
        updateUser({ name: updated.name });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    });
  };

  const backPath =
    profile?.role === "MENTOR"     ? "/mentor"
    : profile?.role === "SuperADMIN" ? "/admin/placements"
    : profile?.role === "AIGs"       ? "/admin/disha"
    : "/student";

  return (
    <div className="min-h-screen app-bg text-emerald-950 font-sans">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-[#F5F7FA] shadow-2xl flex flex-col">

        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 -ml-2 rounded-full hover:bg-emerald-50 text-emerald-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-lg leading-tight text-emerald-950">
              {isMentor ? "Edit Profile" : "My Profile"}
            </h1>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
              {isLoading ? "Loading…" : profile?.email}
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-8">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center font-black text-2xl mb-3">
              {(profile?.name || "?")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .substring(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex items-center gap-2">
              <User size={12} className="text-emerald-700/50" />
              <span className="text-xs font-bold text-emerald-700/60 uppercase tracking-widest">
                {profile?.role}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Read-only account info */}
            <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                Account
              </p>

              {/* Name — locked to Google account */}
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile?.name ?? ""}
                  disabled
                  className="w-full bg-slate-50 border border-emerald-900/5 rounded-xl px-4 py-3 text-sm font-bold text-emerald-800/40 outline-none cursor-not-allowed"
                />
                <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
                  Synced from your Google account — cannot be changed here
                </p>
              </div>

              {/* Email — always locked */}
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  className="w-full bg-slate-50 border border-emerald-900/5 rounded-xl px-4 py-3 text-sm font-bold text-emerald-800/40 outline-none cursor-not-allowed"
                />
                <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
                  Email cannot be changed
                </p>
              </div>
            </div>

            {/* Student-only: cohort + Disha mentor */}
            {profile?.role === "STUDENT" && (profile?.cohort || profile?.dishaMentor) && (
              <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                  Disha Assignment
                </p>
                {profile?.cohort && (
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                      Cohort
                    </label>
                    <input
                      type="text"
                      value={profile.cohort}
                      disabled
                      className="w-full bg-slate-50 border border-emerald-900/5 rounded-xl px-4 py-3 text-sm font-bold text-emerald-800/40 outline-none cursor-not-allowed"
                    />
                  </div>
                )}
                {profile?.dishaMentor && (
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                      Your Disha Mentor
                    </label>
                    <input
                      type="text"
                      value={profile.dishaMentor}
                      disabled
                      className="w-full bg-slate-50 border border-emerald-900/5 rounded-xl px-4 py-3 text-sm font-bold text-emerald-800/40 outline-none cursor-not-allowed"
                    />
                    <p className="text-[10px] font-semibold text-emerald-700/40 mt-1 pl-1">
                      Assigned by Disha — cannot be changed
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mentor-only: editable firm + domain */}
            {isMentor && (
              <form onSubmit={handleSave}>
                <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700/50 -mb-1">
                    Mentor Profile
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                      Current Firm / Organisation
                    </label>
                    <input
                      type="text"
                      value={firm}
                      onChange={(e) => setFirm(e.target.value)}
                      placeholder="e.g. McKinsey & Co."
                      className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                      Domain / Function
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. Strategy Consulting"
                      className="w-full bg-[#F5F7FA] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {mutation.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
                    <p className="text-xs font-bold text-red-700">{mutation.error.message}</p>
                  </div>
                )}

                {saved && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4 flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-700">Profile saved successfully</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full mt-4 bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {mutation.isPending
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Save size={16} />}
                  {mutation.isPending ? "Saving…" : "Save Changes"}
                </button>
              </form>
            )}
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
