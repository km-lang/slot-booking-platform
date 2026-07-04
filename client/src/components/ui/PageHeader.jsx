import { ArrowLeft } from "lucide-react";

// Standardizes the sticky header scaffold duplicated (with drifting
// backdrop-blur strength) across ~11 pages onto one recipe: back button OR a
// leading icon, title/subtitle, and a right-side actions slot.
export default function PageHeader({ title, subtitle, onBack, icon, actions }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-emerald-900/5 px-4 header-safe-top py-3 flex items-center gap-3 transition-all duration-300">
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
        <h1 className="font-display font-semibold text-lg leading-tight text-emerald-950 truncate">{title}</h1>
        {subtitle && (
          <p className="text-[10px] font-bold text-emerald-700/60 uppercase tracking-widest">{subtitle}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
