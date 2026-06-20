import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// TEMP: Google auth disabled — flip back to false to re-enable role gating.
const AUTH_DISABLED = true;

export default function RequireRole({ role }) {
  const { isAuthenticated, role: userRole } = useAuth();

  if (AUTH_DISABLED) return <Outlet />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
