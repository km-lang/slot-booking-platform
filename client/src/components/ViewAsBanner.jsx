import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { useAuth } from "../context/useAuth";

// Shown on every page while the viewer is inside a read-only view-as session.
export default function ViewAsBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user?.viewAs) return null;
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-emerald-950 text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl max-w-[92vw]">
      <Eye size={14} className="shrink-0" />
      <span className="truncate">Viewing as {user.viewAs} · read-only</span>
      <button onClick={() => navigate("/view-as")} className="underline underline-offset-2 whitespace-nowrap">Switch view</button>
    </div>
  );
}
