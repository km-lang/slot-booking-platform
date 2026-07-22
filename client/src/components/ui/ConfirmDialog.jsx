import React from "react";
import Sheet from "./Sheet";

// In-app confirmation, built on the same Sheet primitive as Reassign/Swap/Allocate
// — deliberately not window.confirm(). Several mobile in-app browsers (WhatsApp,
// Instagram, LinkedIn webviews) silently suppress native confirm()/alert() dialogs,
// so a button gated by window.confirm() can appear to do nothing at all when
// tapped from inside one of those — no popup, no error, no visible failure.
export default function ConfirmDialog({
  isOpen, title, message, confirmLabel = "Confirm", danger = false,
  pending = false, error = null, onConfirm, onCancel,
}) {
  return (
    <Sheet isOpen={isOpen} onClose={onCancel} maxWidthClassName="max-w-md">
      <h3 className="text-lg font-black text-emerald-950 mb-1.5">{title}</h3>
      <p className="text-sm font-semibold text-emerald-800/70 mb-5">{message}</p>
      {error && (
        <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`flex-1 font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 text-white ${
            danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-900 hover:bg-emerald-800"
          }`}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
