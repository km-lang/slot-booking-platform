import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

// Dual-mode time field: type digits directly ("1430", "930", "14") OR click the
// clock icon to open the platform's native time picker — either path lands on
// the same "HH:MM" value/onChange contract as <input type="time">. Typing never
// forces the picker open (unlike a bare type="time" input, which on iOS Safari
// renders as a spin-wheel with no typing at all); the picker is purely opt-in via
// the icon, using showPicker() on a hidden paired <input type="time">. Digits
// typed while focused are only normalized to "HH:MM" on blur, so mid-typing
// states are never fought. 1-2 digits are read as an hour (minutes default to
// 00); 3-4 digits split as H(H)+MM. Anything that doesn't parse reverts to the
// last value.
export default function TimeField({ value, onChange, className = "", placeholder = "HH:MM" }) {
  const [text, setText] = useState(value ?? "");
  const nativeRef = useRef(null);

  useEffect(() => { setText(value ?? ""); }, [value]);

  const commit = () => {
    const digits = text.replace(/\D/g, "");
    if (digits.length === 0) { setText(value ?? ""); return; }
    let h, m;
    if (digits.length <= 2) {
      h = parseInt(digits, 10) || 0;
      m = 0;
    } else {
      m = parseInt(digits.slice(-2), 10) || 0;
      h = parseInt(digits.slice(0, digits.length - 2), 10) || 0;
    }
    h = Math.min(23, h);
    m = Math.min(59, m);
    const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setText(formatted);
    if (formatted !== value) onChange(formatted);
  };

  // showPicker() isn't supported in Safari — falls back to focusing the hidden
  // native input, which still lets Safari's own time UI take over from there.
  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
    }
  };

  const handleNativeChange = (e) => {
    const v = e.target.value; // already "HH:MM" from the native picker
    if (!v) return;
    setText(v);
    if (v !== value) onChange(v);
  };

  return (
    <div className={`relative flex items-center gap-1.5 ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="flex-1 min-w-0 bg-transparent outline-none"
      />
      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Pick time"
        className="shrink-0 text-emerald-700/40 hover:text-emerald-700 transition-colors"
      >
        <Clock size={14} strokeWidth={2.5} />
      </button>
      <input
        ref={nativeRef}
        type="time"
        value={value ?? ""}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}
