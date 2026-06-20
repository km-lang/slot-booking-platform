import { Outlet } from "react-router-dom";

// Phase 1 stub: passes all requests through regardless of role.
// Wired to AuthContext in Phase 3 — will redirect to /unauthorized on mismatch.
export default function RequireRole({ role }) {
  void role;
  return <Outlet />;
}
