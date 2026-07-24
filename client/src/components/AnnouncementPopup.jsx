import React, { useState } from "react";
import { Star, Sparkles, MessageCircleHeart, Mail } from "lucide-react";
import Sheet from "./ui/Sheet";
import { usePendingAnnouncement, useRespondToAnnouncement } from "../hooks/useApi";
import { useAuth } from "../context/useAuth";

const SUPPORT_EMAIL = "km@iiml.ac.in";

// Deliberately not closable via backdrop click or an X button — the whole point
// is that it keeps reappearing until the user gives an explicit answer
// (a rating, "Don't want to rate", or "Acknowledged"). Mounted once at the app
// root (see App.jsx) so it can surface on top of any page for any authenticated
// role; the server decides what's pending and for whom.
export default function AnnouncementPopup() {
  const { isAuthenticated } = useAuth();
  const { data } = usePendingAnnouncement(isAuthenticated);
  const respond = useRespondToAnnouncement();
  const [rating, setRating] = useState(0);

  const announcement = data?.announcement ?? null;
  const isOpen = !!announcement;

  const submit = (response, ratingValue) => {
    if (!announcement) return;
    respond.mutate(
      { id: announcement.id, response, rating: ratingValue },
      { onSuccess: () => setRating(0) },
    );
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => {}} maxWidthClassName="max-w-sm">
      {announcement && (
        <>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 mb-4">
            {announcement.type === "feedback" ? <MessageCircleHeart size={22} /> : <Sparkles size={22} />}
          </div>
          <h3 className="text-lg font-black text-emerald-950 mb-1.5">{announcement.title}</h3>
          <p className="text-sm font-semibold text-emerald-800/70 mb-6">{announcement.message}</p>

          {respond.error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {respond.error.message}
            </p>
          )}

          {announcement.type === "feedback" ? (
            <>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={respond.isPending}
                    onClick={() => { setRating(n); submit("rating", n); }}
                    className="p-1 disabled:opacity-50"
                    title={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    <Star
                      size={30}
                      className={n <= rating ? "text-amber-400" : "text-emerald-900/15"}
                      fill={n <= rating ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => submit("skipped", null)}
                disabled={respond.isPending}
                className="w-full text-center text-xs font-bold text-emerald-700/50 hover:text-emerald-700 disabled:opacity-50 py-1"
              >
                {respond.isPending ? "Working…" : "Don't want to rate"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => submit("acknowledged", null)}
              disabled={respond.isPending}
              className="w-full bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95"
            >
              {respond.isPending ? "Working…" : "Acknowledged"}
            </button>
          )}

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-emerald-900/10 text-[11px] font-semibold text-emerald-700/50">
            <Mail size={13} className="shrink-0" />
            <span>
              Need help? Reach out to Team SynapsE at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-700 hover:underline">{SUPPORT_EMAIL}</a>
            </span>
          </div>
        </>
      )}
    </Sheet>
  );
}
