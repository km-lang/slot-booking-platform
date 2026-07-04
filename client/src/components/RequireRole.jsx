import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/useAuth";

export default function RequireRole({ role }) {
  const { isAuthenticated, isLoading, role: userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen-safe app-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-emerald-700/40" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(userRole)) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}
