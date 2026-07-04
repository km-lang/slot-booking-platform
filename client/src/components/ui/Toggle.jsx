import { motion } from "framer-motion";

// Extraction of the div-based switch repeated identically across
// CreateSlotsFlow.jsx / PlacementAdminDashboard.jsx — same look, but the knob
// now springs instead of snapping between positions.
export default function Toggle({ checked, onChange, disabled = false }) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`w-12 h-6 rounded-full relative shrink-0 transition-colors ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
        animate={{ left: checked ? "1.75rem" : "0.25rem" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}
