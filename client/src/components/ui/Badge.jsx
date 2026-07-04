const TONES = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  gold: "bg-[#f3ecd8] text-[#5b4e27] border-[#e3dcc7]",
};

// One tone-driven API meant to replace the ROLE_BADGE / ACTION_BADGE / ad hoc
// pill maps duplicated across AvatarMenu.jsx and PlacementAdminDashboard.jsx.
export default function Badge({ tone = "neutral", pill = true, className = "", children }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border ${
        pill ? "rounded-full" : "rounded"
      } ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
