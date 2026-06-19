import { Routes, Route, Navigate } from "react-router-dom";
import StudentLayout from "./pages/StudentLayout";
import StudentDashboard from "./pages/StudentDashboard";
import MentorBookingView from "./pages/MentorBookingView";
import MentorDashboard from "./pages/MentorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import MentorCohortDetails from "./pages/MentorCohortDetails";
import TeamDishaDashboard from "./pages/TeamDishaDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student" replace />} />
      {/* The Student Flow now lives inside the persistent layout */}
      <Route element={<StudentLayout />}>
        {/* Screen 1 & 2: AIG and Mentor Selection */}
        <Route path="/student" element={<StudentDashboard />} />
        {/* Screen 3: The actual slots */}
        <Route
          path="/student/:group/:mentorId"
          element={<MentorBookingView />}
        />
      </Route>
      {/* Mentor Flow */}
      <Route path="/mentor" element={<MentorDashboard />} />
      <Route path="/mentor/cohort" element={<MentorCohortDetails />} />{" "}
      {/* Placement Chair Flow */}
      <Route path="/admin" element={<AdminDashboard />} />
      {/* Team Disha Flow */}
      <Route path="/team-disha" element={<TeamDishaDashboard />} />
    </Routes>
  );
}

export default App;
