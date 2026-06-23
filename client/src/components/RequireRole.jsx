import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function RequireRole({ role }) {
  const { isAuthenticated, isLoading, role: userRole } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(userRole)) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
