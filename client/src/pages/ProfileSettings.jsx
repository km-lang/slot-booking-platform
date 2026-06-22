import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Save, CheckCircle } from "lucide-react";
import { useProfile, useUpdateProfile } from "../hooks/useApi";
import { useAuth } from "../context/useAuth";

export default function ProfileSettings() {
  const navigate    = useNavigate();
  const { updateUser } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const mutation    = useUpdateProfile();

  const [name,   setName]   = useState("");
  const [firm,   setFirm]   = useState("");
  const [domain, setDomain] = useState("");
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setFirm(profile.firm ?? "");
      setDomain(profile.domain ?? "");
    }
  }, [profile]);

  const isMentor = profile?.role === "MENTOR";

  const handleSave = (e) => {
    e.preventDefault();
    const body = { name: name.trim() };
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
    : profile?.role === "AIGs"       ? "/admin/disha" // best-effort
    : "/student";

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-emerald-950 font-sans sm:bg-slate-100">
      <div className="max-w-md mx-auto min-h-screen bg-[#F8FAF7] shadow-2xl flex flex-col">

        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-900/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 -ml-2 rounded-full hover:bg-emerald-50 text-emerald-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-black text-lg leading-tight text-emerald-950">Edit Profile</h1>
            <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
              {isLoading ? "Loading…" : profile?.email}
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 py-8">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center font-black text-2xl mb-3">
              {(name || profile?.name || "?")
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

          <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-white border border-emerald-900/10 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
                />
              </div>

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

            {isMentor && (
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
                    className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
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
                    className="w-full bg-[#F8FAF7] border border-emerald-900/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-950 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {mutation.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-700">{mutation.error.message}</p>
              </div>
            )}

            {saved && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700">Profile saved successfully</p>
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending || isLoading || !name.trim()}
              className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {mutation.isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save size={16} />}
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
