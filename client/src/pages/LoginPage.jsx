import React from "react";
import { Shield } from "lucide-react";

// Phase 1 placeholder — Google Identity Services button wired in Phase 3.
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAF7] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-900 flex items-center justify-center text-emerald-400 mx-auto mb-6">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-black text-emerald-950 mb-1">
          Parthsaarthi
        </h1>
        <p className="text-sm font-semibold text-emerald-700/60 mb-8">
          SIP Mentor Booking · IIM Lucknow
        </p>
        <div className="bg-white border border-emerald-900/10 rounded-2xl p-6 shadow-sm max-w-xs mx-auto">
          <p className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest mb-4">
            Sign in with
          </p>
          <button
            disabled
            className="w-full bg-slate-100 text-slate-400 font-bold py-3 px-6 rounded-xl text-sm cursor-not-allowed"
          >
            Google (coming in Phase 3)
          </button>
        </div>
      </div>
    </div>
  );
}
