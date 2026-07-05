import { ArrowLeft } from "lucide-react";

// Standardizes the sticky header scaffold duplicated (with drifting
// backdrop-blur strength) across ~11 pages onto one recipe: back button OR a
// leading icon, title/subtitle, and a right-side actions slot.
// `subtitleCase="upper"` (default) suits label-style subtitles ("SIP PREP
// 2026", booking counts); pass "normal" for sentence-style ones ("with Jane Doe").
export default function PageHeader({ title, subtitle, subtitleCase = "upper", onBack, icon, actions }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-emerald-900/5 px-4 header-safe-top pb-3 flex items-center gap-3 transition-all duration-300">
      {onBack ? (
        <button
          onClick={onBack}
          className="p-3 -ml-3 rounded-full hover:bg-emerald-50 active:bg-emerald-100 text-emerald-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      ) : icon ? (
        <div className="w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center text-emerald-400 shrink-0">
          {icon}
        </div>
      ) : null}

      <div className="flex-1 min-w-0">
        <h1 className="font-black text-lg leading-tight text-emerald-950 truncate">{title}</h1>
        {subtitle && (
          <p
            className={`text-emerald-700/60 truncate ${
              subtitleCase === "upper"
                ? "text-[10px] font-bold uppercase tracking-widest"
                : "text-[11px] font-semibold"
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
