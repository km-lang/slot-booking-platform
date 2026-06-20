import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function RequireRole({ role }) {
  const { isAuthenticated, role: userRole } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
