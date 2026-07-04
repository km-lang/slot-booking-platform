import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "bg-emerald-900 hover:bg-emerald-800 text-white disabled:bg-slate-200 disabled:text-slate-400",
  secondary: "bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-900/10 disabled:bg-slate-100 disabled:text-slate-400",
  danger: "bg-red-600 hover:bg-red-700 text-white disabled:bg-slate-200 disabled:text-slate-400",
  ghost: "bg-transparent hover:bg-emerald-50 text-emerald-800 disabled:text-slate-300",
};

export default function Button({
  variant = "primary",
  loading = false,
  loadingText,
  className = "",
  disabled,
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold py-3 px-6 transition-all active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
