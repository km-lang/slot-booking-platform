import React, { useRef, useState } from "react";

const LONG_PRESS_MS = 450;
const TOOLTIP_LINGER_MS = 1000;

// Icon-only action button for touch-first screens. Desktop hover uses the native
// `title` tooltip; touch devices have no hover, so holding the button down shows
// the same label instead of firing the click — a quick tap still clicks normally.
export default function IconButton({ icon: Icon, label, onClick, href, disabled, size = 15, className = "" }) {
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startPress = () => {
    if (disabled) return;
    longPressedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setShowTip(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    clearTimer();
    if (longPressedRef.current) setTimeout(() => setShowTip(false), TOOLTIP_LINGER_MS);
  };

  const handleClick = (e) => {
    if (longPressedRef.current) {
      e.preventDefault();
      longPressedRef.current = false;
      return;
    }
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const sharedProps = {
    title: label,
    onClick: handleClick,
    onTouchStart: startPress,
    onTouchEnd: endPress,
    onTouchCancel: endPress,
    onContextMenu: (e) => e.preventDefault(),
    style: { WebkitTouchCallout: "none" },
    className: `select-none w-10 h-10 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${disabled ? "opacity-40" : ""} ${className}`,
  };

  return (
    <div className="relative flex">
      {showTip && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-950 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg z-20 pointer-events-none">
          {label}
        </span>
      )}
      {href ? (
        <a href={disabled ? undefined : href} aria-disabled={disabled} {...sharedProps}>
          <Icon size={size} />
        </a>
      ) : (
        <button type="button" disabled={disabled} {...sharedProps}>
          <Icon size={size} />
        </button>
      )}
    </div>
  );
}
