import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// Wraps a dashboard list behind a header that shows just the count until
// tapped — keeps the page short as the underlying list grows instead of
// dumping every row on screen at once.
export default function CollapsibleSection({ title, count, badgeClassName, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between mb-2 px-1"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-emerald-800/50 uppercase tracking-widest">
            {title}
          </h2>
          {count > 0 && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeClassName}`}>
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-emerald-700/50 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && children}
    </div>
  );
}
