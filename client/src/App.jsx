import { Routes, Route, Navigate } from "react-router-dom";
import RequireRole from "./components/RequireRole";
import PageTransition from "./components/ui/PageTransition";
import AnnouncementPopup from "./components/AnnouncementPopup";
import StudentLayout from "./pages/StudentLayout";
import StudentDashboard from "./pages/StudentDashboard";
import StudentMyBookings from "./pages/StudentMyBookings";
import MentorBookingView from "./pages/MentorBookingView";
import MentorDashboard from "./pages/MentorDashboard";
import MentorCohortDetails from "./pages/MentorCohortDetails";
import CreateSlotsFlow from "./pages/CreateSlotsFlow";
import RescheduleSlot from "./pages/RescheduleSlot";
import AigAdminDashboard from "./pages/AigAdminDashboard";
import AigMentorDetail from "./pages/AigMentorDetail";
import AdminStudentDetail from "./pages/AdminStudentDetail";
import PlacementAdminDashboard from "./pages/PlacementAdminDashboard";
import AcademicSecyDashboard from "./pages/AcademicSecyDashboard";
import ProfileSettings from "./pages/ProfileSettings";
import LoginPage from "./pages/LoginPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

// Wraps every leaf page element (never a layout route) so navigation fades
// instead of hard-cutting — see PageTransition.jsx for why layouts are excluded.
const t = (element) => <PageTransition>{element}</PageTransition>;

function App() {
  return (
    <>
    <AnnouncementPopup />
    <Routes>
      <Route path="/login" element={t(<LoginPage />)} />
      <Route path="/unauthorized" element={t(<UnauthorizedPage />)} />
      <Route path="/profile" element={t(<ProfileSettings />)} />
      <Route path="/" element={<Navigate to="/student" replace />} />

      {/* Student flow */}
      <Route element={<RequireRole role="STUDENT" />}>
        <Route element={<StudentLayout />}>
          <Route path="/student" element={t(<StudentDashboard />)} />
          <Route
            path="/student/:group/:mentorId"
            element={t(<MentorBookingView />)}
          />
          <Route path="/student/bookings" element={t(<StudentMyBookings />)} />
        </Route>
      </Route>

      {/* Mentor flow */}
      <Route element={<RequireRole role="MENTOR" />}>
        <Route path="/mentor" element={t(<MentorDashboard />)} />
        <Route path="/mentor/cohort" element={t(<MentorCohortDetails />)} />
        <Route path="/mentor/slots/new" element={t(<CreateSlotsFlow />)} />
        <Route path="/mentor/slots/:slotId/reschedule" element={t(<RescheduleSlot />)} />
      </Route>

      {/* Static /admin/placements* must be declared before dynamic /admin/:aigSlug */}
      <Route element={<RequireRole role="SuperADMIN" />}>
        <Route
          path="/admin/placements"
          element={t(<PlacementAdminDashboard />)}
        />
        <Route path="/admin/placements/mentor/:mentorSlug" element={t(<AigMentorDetail />)} />
        <Route path="/admin/placements/student/:pgpId" element={t(<AdminStudentDetail />)} />
      </Route>

      {/* Academic Secretary — read-only, cross-group mentoring activity only
          (no student roster access). See AcademicSecyDashboard.jsx. */}
      <Route element={<RequireRole role="ACADEMIC_SECY_VIEW" />}>
        <Route path="/admin/secy" element={t(<AcademicSecyDashboard />)} />
      </Route>

      <Route element={<RequireRole role="AIGs" />}>
        <Route path="/admin/:aigSlug" element={t(<AigAdminDashboard />)} />
      </Route>

      <Route element={<RequireRole role={["AIGs", "SuperADMIN"]} />}>
        <Route path="/admin/:aigSlug/mentor/:mentorSlug" element={t(<AigMentorDetail />)} />
      </Route>
    </Routes>
    </>
  );
}

export default App;
