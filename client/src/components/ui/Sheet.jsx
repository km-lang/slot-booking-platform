import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Generalizes MentorBookingView.jsx's bottom-sheet (backdrop fade + spring
// slide) into a reusable, conditionally-mounted component. Fixes the two
// sheets in MentorDashboard.jsx that previously mounted/unmounted instantly
// with no transition at all.
export default function Sheet({
  isOpen,
  onClose,
  children,
  maxWidthClassName = "max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl",
}) {
  // Every caller nulls its "target" state on close, which would otherwise blank
  // the sheet's content mid-slide-down (children go from real data to `null`
  // in the same render that isOpen flips false). Freezing the last real
  // children while isOpen was true keeps the content visible through the exit
  // animation instead of flashing empty.
  const [content, setContent] = useState(children);
  useEffect(() => {
    if (isOpen) setContent(children);
  }, [isOpen, children]);

  // Body-scroll lock while open — was previously hand-rolled only in
  // MentorBookingView; centralizing it here fixes every other sheet that
  // didn't have it (background content scrolling behind an open sheet).
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            key="sheet"
            className={`fixed bottom-0 left-0 right-0 mx-auto ${maxWidthClassName} bg-white rounded-t-3xl shadow-elevated z-50 p-6 pb-safe-8 max-h-[85vh] overflow-y-auto`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            {content}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
