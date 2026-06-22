import { Routes, Route, Navigate } from "react-router-dom";
import RequireRole from "./components/RequireRole";
import StudentLayout from "./pages/StudentLayout";
import StudentDashboard from "./pages/StudentDashboard";
import StudentMyBookings from "./pages/StudentMyBookings";
import MentorBookingView from "./pages/MentorBookingView";
import MentorDashboard from "./pages/MentorDashboard";
import MentorCohortDetails from "./pages/MentorCohortDetails";
import AigAdminDashboard from "./pages/AigAdminDashboard";
import PlacementAdminDashboard from "./pages/PlacementAdminDashboard";
import ProfileSettings from "./pages/ProfileSettings";
import LoginPage from "./pages/LoginPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/profile" element={<ProfileSettings />} />
      <Route path="/" element={<Navigate to="/student" replace />} />

      {/* Student flow */}
      <Route element={<RequireRole role="STUDENT" />}>
        <Route element={<StudentLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route
            path="/student/:group/:mentorId"
            element={<MentorBookingView />}
          />
        </Route>
        <Route path="/student/bookings" element={<StudentMyBookings />} />
      </Route>

      {/* Mentor flow */}
      <Route element={<RequireRole role="MENTOR" />}>
        <Route path="/mentor" element={<MentorDashboard />} />
        <Route path="/mentor/cohort" element={<MentorCohortDetails />} />
      </Route>

      {/* Static /admin/placements must be declared before dynamic /admin/:aigSlug */}
      <Route element={<RequireRole role="SuperADMIN" />}>
        <Route
          path="/admin/placements"
          element={<PlacementAdminDashboard />}
        />
      </Route>

      <Route element={<RequireRole role="AIGs" />}>
        <Route path="/admin/:aigSlug" element={<AigAdminDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
