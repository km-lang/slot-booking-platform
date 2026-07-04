// `glass` swaps onto the .glass-card utility (index.css) instead of a flat
// white surface — same card shape everywhere, just a different material.
export default function Card({ glass = false, className = "", children, ...props }) {
  const surface = glass ? "glass-card" : "bg-white border border-emerald-900/10 shadow-sm";
  return (
    <div className={`${surface} rounded-2xl p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
