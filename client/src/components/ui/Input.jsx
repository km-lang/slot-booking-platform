export default function Input({ label, error, className = "", id, ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-wide mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full min-w-0 bg-[var(--color-bg)] border rounded-xl px-4 py-3 text-sm font-semibold text-emerald-950 outline-none transition-colors ${
          error ? "border-red-300 focus:border-red-500" : "border-emerald-900/10 focus:border-emerald-500"
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-bold text-red-600 mt-1">{error}</p>}
    </div>
  );
}
