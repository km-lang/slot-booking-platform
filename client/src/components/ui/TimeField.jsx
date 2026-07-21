import React, { useState, useEffect } from "react";

// Free-typed 24h time field ("HH:MM") — same value/onChange contract as
// <input type="time">, but never forces the platform's clock-wheel picker (iOS
// Safari in particular renders type="time" as a spin wheel with no typing).
// Digits typed while focused (e.g. "1430", "930", "14") are only normalized to
// "HH:MM" on blur, so the wheel never appears and mid-typing states are never
// fought. 1-2 digits are read as an hour (minutes default to 00); 3-4 digits
// split as H(H)+MM. Anything that doesn't parse reverts to the last value.
export default function TimeField({ value, onChange, className = "", placeholder = "HH:MM" }) {
  const [text, setText] = useState(value ?? "");

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

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className={className}
    />
  );
}
