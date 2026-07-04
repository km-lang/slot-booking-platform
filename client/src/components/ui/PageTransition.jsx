import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

// Wraps an individual route's page element (never a layout) so navigation
// fades/slides instead of hard-cutting. Deliberately self-contained — each
// instance keys off its own location.pathname rather than the app keying
// <Routes> globally, so layouts like StudentLayout that wrap an <Outlet/>
// stay mounted across nested navigation (its header comment already flags
// that remounting it reintroduces a flash).
export default function PageTransition({ children }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
