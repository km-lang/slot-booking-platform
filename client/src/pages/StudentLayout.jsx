import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Briefcase } from "lucide-react";

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine if we show the back button based on URL depth
  const isRoot = location.pathname === "/student";

  return (
    <div className="min-h-screen app-bg font-sans">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen bg-[#F5F7FA] shadow-2xl relative flex flex-col overflow-hidden">
        {/* PERMANENT HEADER: Never unmounts, preventing the "flash" */}
        <header className="absolute top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-emerald-900/5 px-4 py-3 flex items-center gap-3 transition-all duration-300">
          {!isRoot ? (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400">
              <Briefcase size={18} />
            </div>
          )}

          <div className="flex-1">
            <h1 className="font-black text-lg leading-tight text-emerald-950">
              {isRoot ? "SIP Prep 2026" : "Select Mentor"}
            </h1>
          </div>
        </header>

        {/* DYNAMIC CONTENT: Pages render inside here */}
        <div className="flex-1 overflow-y-auto pt-[60px] pb-8 relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
