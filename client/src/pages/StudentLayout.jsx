import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Briefcase } from "lucide-react";
import AvatarMenu from "../components/AvatarMenu";

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine if we show the back button based on URL depth
  const isRoot = location.pathname === "/student";

  return (
    <div className="min-h-screen-safe app-bg font-sans">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto min-h-screen-safe bg-[var(--color-bg)] shadow-2xl relative flex flex-col">
        {/* PERMANENT HEADER: Never unmounts, preventing the "flash" — sticky (not
            absolute) so it stays reachable while the page scrolls. absolute here
            positioned it relative to a container that grows past one viewport with
            content, so on any page long enough to scroll (e.g. a mentor with more
            than a handful of slots) the header — including the back button and the
            account menu — scrolled away and became completely unreachable. */}
        <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-emerald-900/5 px-4 header-safe-top flex items-center gap-3 transition-all duration-300">
          {!isRoot ? (
            <button
              onClick={() => navigate(-1)}
              className="p-3 -ml-3 rounded-full hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400 shrink-0">
              <Briefcase size={18} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-black text-lg leading-tight text-emerald-950 truncate">
              {isRoot ? "Book your Slot" : "Select Mentor"}
            </h1>
            {isRoot && (
              <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">
                SIP Prep 2026
              </p>
            )}
          </div>

          {isRoot && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate("/student")}
                className="bg-emerald-900 hover:bg-emerald-800 text-white text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] active:scale-95 transition-all"
              >
                Shukracharya
              </button>
              <AvatarMenu />
            </div>
          )}
        </header>

        {/* DYNAMIC CONTENT: Pages render inside here. Sticky header above already
            occupies its own space in normal flow, so no manual top-padding
            compensation is needed here (that was only ever working around the
            header being pulled out of flow via `absolute`). */}
        <div className="flex-1 pb-8 relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
