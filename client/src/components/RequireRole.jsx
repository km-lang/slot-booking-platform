import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function RequireRole({ role }) {
  const { isAuthenticated, isLoading, role: userRole } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
