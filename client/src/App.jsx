import { Routes, Route, Navigate } from "react-router-dom";
import StudentDirectory from "./pages/StudentDirectory";
import MentorBookingView from "./pages/MentorBookingView";
import MentorDashboard from "./pages/MentorDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student" replace />} />

      {/* Student Flows */}
      <Route path="/student" element={<StudentDirectory />} />
      <Route path="/student/:group/:mentorId" element={<MentorBookingView />} />

      {/* Mentor Flow */}
      <Route path="/mentor" element={<MentorDashboard />} />

      {/* Placement Chair Flow */}
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;
