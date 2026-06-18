import { Routes, Route, Navigate } from "react-router-dom";
import StudentDashboard from "./pages/StudentDashboard";
import MentorDashboard from "./pages/MentorDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student" replace />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/mentor" element={<MentorDashboard />} />

      {/* Placeholder for Placement Chair */}
      <Route
        path="/admin"
        element={
          <div className="p-8 text-emerald-950">Admin UI Coming Next</div>
        }
      />
    </Routes>
  );
}

export default App;
