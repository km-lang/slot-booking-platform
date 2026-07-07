import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import AvatarMenu from "../components/AvatarMenu";
import AppShell from "../components/ui/AppShell";
import PageHeader from "../components/ui/PageHeader";
import psLogo from "../assets/PSLogo.png";

const TITLES = {
  "/student": { title: "Parthsaarthi", subtitle: "Book your slots" },
  "/student/bookings": { title: "My Sessions" },
};

export default function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Nested pages (currently only StudentMyBookings) can override the header's
  // subtitle/right-side actions via the outlet context below — the layout
  // itself has no idea what a booking count or an export button is.
  const [headerExtra, setHeaderExtra] = useState({});

  const isRoot = location.pathname === "/student";
  const known = TITLES[location.pathname];

  const onBack = isRoot
    ? undefined
    : location.pathname === "/student/bookings"
      ? () => navigate("/student")
      : () => navigate(-1);

  return (
    <AppShell
      header={
        // PERMANENT HEADER: Never unmounts, preventing the "flash" — this
        // AppShell/PageHeader pair renders once per StudentLayout mount, and
        // only the <Outlet/> content below swaps as nested routes change.
        <PageHeader
          title={known?.title ?? "Select Mentor"}
          subtitle={known?.subtitle ?? headerExtra.subtitle}
          icon={isRoot ? <img src={psLogo} alt="Parthsaarthi" className="w-8 h-8 rounded-lg object-contain bg-white" /> : undefined}
          onBack={onBack}
          actions={
            isRoot ? (
              <>
                <button
                  onClick={() => navigate("/student")}
                  className="bg-emerald-900 hover:bg-emerald-800 text-white text-[10px] font-black uppercase tracking-wide px-3 py-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] active:scale-95 transition-all shrink-0"
                >
                  Shukracharya
                </button>
                <AvatarMenu />
              </>
            ) : (
              headerExtra.actions
            )
          }
        />
      }
    >
      <Outlet context={{ setHeaderExtra }} />
    </AppShell>
  );
}
