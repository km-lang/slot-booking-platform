// `glass` swaps onto the .glass-card utility (index.css) instead of a flat
// white surface — same card shape everywhere, just a different material.
// `padding` is a prop rather than baked into `className` so callers that need
// a non-default spacing (p-3, p-8, ...) don't end up with two conflicting
// Tailwind padding utilities in the same class list.
export default function Card({ glass = false, padding = "p-5", className = "", children, ...props }) {
  const surface = glass ? "glass-card" : "bg-white border border-emerald-900/10 shadow-sm";
  return (
    <div className={`${surface} rounded-2xl ${padding} ${className}`} {...props}>
      {children}
    </div>
  );
}
