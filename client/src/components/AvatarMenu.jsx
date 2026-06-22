import React, { useState, useRef, useEffect } from "react";
import { LogOut, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const ROLE_BADGE = {
  SuperADMIN: "bg-purple-100 text-purple-800 border-purple-200",
  AIGs: "bg-amber-100 text-amber-800 border-amber-200",
  MENTOR: "bg-emerald-100 text-emerald-800 border-emerald-200",
  STUDENT: "bg-slate-100 text-slate-700 border-slate-200",
};

// variant="light" — dark initials on light bg (white headers)
// variant="dark"  — light initials on dark bg (emerald-900 header in MentorDashboard)
export default function AvatarMenu({ variant = "light" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2) ?? "?";

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const btnCls =
    variant === "dark"
      ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
      : "bg-emerald-900 text-emerald-50 border-emerald-800 hover:bg-emerald-800";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${btnCls}`}
        aria-label="Account menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white rounded-2xl shadow-xl border border-emerald-900/10 z-[100] overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-900/5">
            <p className="font-bold text-sm text-emerald-950 truncate">{user?.name ?? "—"}</p>
            <p className="text-[11px] font-semibold text-emerald-700/60 truncate mt-0.5">
              {user?.email}
            </p>
            <span
              className={`inline-block mt-1.5 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${ROLE_BADGE[user?.role] ?? ROLE_BADGE.STUDENT}`}
            >
              {user?.role}
            </span>
          </div>
          <button
            onClick={() => { setOpen(false); navigate("/profile"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 transition-colors border-b border-emerald-900/5"
          >
            <UserCog size={15} className="text-emerald-600" /> Edit Profile
          </button>
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
